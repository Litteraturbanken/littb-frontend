#!/usr/bin/env python3
"""Retain the original lease before registration; resume under the deploy lock.

Never registers jobs or creates replacement leases. Only the immediate next job
version can complete interrupted registration. Its observed index is then pinned.
"""
from dataclasses import asdict
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import tempfile


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.release-')
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream, sort_keys=True, indent=2)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def load_adapter(infra):
    sys.path.insert(0, str(infra))
    from scripts import stage_guard, stage_state
    return stage_guard, stage_state


def main(argv):
    action, repository, infra, *args = argv
    repository, infra = Path(repository).resolve(), Path(infra).resolve()
    guard, state = load_adapter(infra)
    runner = guard.SubprocessRunner()
    path = repository / '.stage-receipts/frontend-pending.json'
    manifest = state.StageManifest.load(infra / 'environments/stage/deployments.yaml')
    candidate = guard.require_exact_remote_stage(repository, runner)
    if action == 'prepare':
        if path.exists():
            raise ValueError('Pending Stage release exists; use deploy-stage.sh --resume')
        lease_path, image, digest, jobspec_hash = args
        lease = guard.StageLease.load(Path(lease_path))
        current = manifest.components['frontend']
        if (lease.candidate_sha != candidate or lease.origin_stage_sha != candidate
                or lease.manifest_component_sha256 != current.canonical_sha256()
                or lease.live_job_modify_index != current.nomad.job_modify_index):
            raise ValueError('Original lease no longer matches Stage')
        live = guard.require_live_identity(current, repository, runner, component='frontend')
        if live.sha256() != lease.live_identity_sha256:
            raise ValueError('Original live identity changed')
        deployment = current.to_mapping()
        deployment['source']['git_sha'] = candidate
        deployment['image'] = {'reference': image, 'digest': digest}
        deployment['jobspec']['git_sha'] = candidate
        deployment['jobspec']['blob_sha256'] = jobspec_hash
        deployment['nomad']['job_version'] += 1
        deployment['nomad']['job_modify_index'] = 1
        deployment['verification']['verified_at'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        state.component_from_mapping(deployment)
        atomic_json(path, {'schema_version': 1, 'lease': asdict(lease),
                          'manifest': manifest.to_mapping(), 'deployment': deployment,
                          'registered': False})
        return
    journal = json.loads(path.read_text())
    if set(journal) != {'schema_version', 'lease', 'manifest', 'deployment', 'registered'} or journal['schema_version'] != 1:
        raise ValueError('Invalid release journal')
    lease = guard.StageLease.from_mapping(journal['lease'])
    original = state.StageManifest.from_mapping(journal['manifest'])
    deployment = state.component_from_mapping(journal['deployment'])
    if candidate != lease.candidate_sha or candidate != lease.origin_stage_sha:
        raise ValueError('Stage candidate changed since original lease')
    receipt = state.DeploymentReceipt.from_mapping({
        'schema_version': state.RECEIPT_SCHEMA_VERSION, 'component': 'frontend',
        'lease': journal['lease'], 'deployment': journal['deployment']})
    guard._validate_receipt_set((receipt,), original)
    expected_recorded = original.to_mapping()
    expected_recorded['components']['frontend'] = deployment.to_mapping()
    already_recorded = manifest.to_mapping() == expected_recorded
    if manifest.to_mapping() != original.to_mapping() and not (journal['registered'] and already_recorded):
        raise ValueError('Stage manifest changed since original lease')
    if not journal['registered']:
        live = guard.inspect_live_identity(deployment, repository, runner, component='frontend')
        if (live.job_version != deployment.nomad.job_version
                or live.job_modify_index <= lease.live_job_modify_index):
            raise ValueError('Expected immediate next Nomad version; release was not registered or job drifted')
        journal['deployment']['nomad']['job_modify_index'] = live.job_modify_index
        deployment = state.component_from_mapping(journal['deployment'])
    guard.require_live_identity(deployment, repository, runner, component='frontend')
    guard._require_identity_endpoint('frontend', deployment, repository, runner)
    for component, other in original.components.items():
        if component != 'frontend':
            guard.require_live_identity(other, repository, runner, component=component)
    if action == 'publish':
        if not already_recorded:
            raise ValueError('No recorded transaction to publish')
        with guard._acquire_manifest_transaction_lock(infra):
            def git(*arguments):
                return guard._git_text(runner, ['git', *arguments], infra, 'record retry')
            common = Path(git('rev-parse', '--path-format=absolute', '--git-common-dir'))
            if common.parent != infra or git('branch', '--show-current') != 'master':
                raise ValueError('Record retry requires primary infrastructure master')
            protected = ['scripts/stage*.py', 'scripts/deploy_corpus*.py',
                         'scripts/deploy_elastic_pipeline_stage.py',
                         'environments/stage/deployments.yaml']
            if git('status', '--porcelain', '--', *protected):
                raise ValueError('Infrastructure deployment files changed')
            remote = guard._fetch_branch(infra, runner, 'master')
            head = git('rev-parse', 'HEAD')
            committed = guard._manifest_at_remote(infra, runner, head)
            if committed.to_mapping() != expected_recorded:
                raise ValueError('Recorded commit differs from release journal')
            if head != remote:
                if git('rev-parse', 'HEAD^') != remote:
                    raise ValueError('Infrastructure history changed; cannot retry record push')
                if git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD') != 'environments/stage/deployments.yaml':
                    raise ValueError('Record commit includes unrelated changes')
                if guard._manifest_at_remote(infra, runner, remote).to_mapping() != original.to_mapping():
                    raise ValueError('Remote Stage manifest changed')
                guard._validate_live_receipts((receipt,), infra, runner)
                git('push', 'origin', 'HEAD:refs/heads/master')
            print(head)
        return
    if action == 'finish':
        if not already_recorded:
            raise ValueError('Release has not been recorded')
        guard.require_committed_remote_master(infra, runner)
        path.unlink()
        return
    if action != 'validate':
        raise ValueError('Unknown journal action')
    journal['registered'] = True
    atomic_json(path, journal)
    lease_path, deployment_path = args
    atomic_json(Path(lease_path), journal['lease'])
    atomic_json(Path(deployment_path), journal['deployment'])
    print('retry-push' if already_recorded else 'record')


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except Exception as error:
        raise SystemExit(f'Stage release retained: {error}') from None
