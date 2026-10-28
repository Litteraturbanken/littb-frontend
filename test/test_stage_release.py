"""Fault-injection tests against the configured infrastructure adapter's models."""
import copy
from contextlib import nullcontext
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, Mock

SPEC = importlib.util.spec_from_file_location('stage_release', Path(__file__).resolve().parents[1] / 'scripts/stage-release.py')
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)
INFRA = os.environ.get('LB_INFRA_REPOSITORY')


@unittest.skipUnless(INFRA, 'set LB_INFRA_REPOSITORY to test against the deployment adapter')
class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.guard, self.state = release.load_adapter(Path(INFRA))
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.infra = self.root / 'infra'
        self.manifest_path = self.infra / 'environments/stage/deployments.yaml'
        self.manifest_path.parent.mkdir(parents=True)
        self.original = self.state.StageManifest.load(Path(INFRA) / 'environments/stage/deployments.yaml')
        self.manifest_path.write_text(self.original.dump())
        self.current = self.original.components['frontend']
        self.sha = 'a' * 40
        self.lease = self.guard.StageLease('frontend', self.sha, self.sha,
            self.current.canonical_sha256(), self.current.nomad.job_modify_index, 'b' * 64)
        self.lease_path = self.root / 'lease.json'
        release.atomic_json(self.lease_path, self.lease.to_mapping())
        self.journal = self.root / '.stage-receipts/frontend-pending.json'
        self.deployment_path = self.root / 'deployment.json'
        self.live = Mock(job_version=self.current.nomad.job_version + 1,
                         job_modify_index=self.current.nomad.job_modify_index + 100)
        self.live.sha256.return_value = 'b' * 64
        for name, result in [('require_exact_remote_stage', self.sha),
                             ('require_live_identity', self.live),
                             ('inspect_live_identity', self.live),
                             ('_require_identity_endpoint', None),
                             ('require_committed_remote_master', 'c' * 40)]:
            mock = patch.object(self.guard, name, return_value=result)
            setattr(self, name, mock.start())
            self.addCleanup(mock.stop)

    def call(self, action, *args):
        release.main([action, str(self.root), str(self.infra), *map(str, args)])

    def prepare(self):
        self.call('prepare', self.lease_path, self.current.image.reference,
                  self.current.image.digest, self.current.jobspec.blob_sha256)

    def validate(self):
        self.call('validate', self.lease_path, self.deployment_path)

    def recorded(self):
        data = json.loads(self.journal.read_text())
        manifest = copy.deepcopy(data['manifest'])
        manifest['components']['frontend'] = data['deployment']
        self.manifest_path.write_text(self.state.StageManifest.from_mapping(manifest).dump())

    def test_original_lease_survives_failure_and_resume_pins_index(self):
        self.prepare()
        before = self.journal.read_bytes()
        self._require_identity_endpoint.side_effect = RuntimeError('network unavailable')
        with self.assertRaisesRegex(RuntimeError, 'network'):
            self.validate()
        self.assertEqual(self.journal.read_bytes(), before)
        self._require_identity_endpoint.side_effect = None
        self.validate()
        data = json.loads(self.journal.read_text())
        self.assertEqual(data['lease'], self.lease.to_mapping())
        self.assertEqual(data['deployment']['nomad']['job_modify_index'], self.live.job_modify_index)
        self.assertTrue(data['registered'])
        self.validate()
        self.assertEqual(json.loads(self.journal.read_text()), data)

    def test_new_deploy_cannot_overwrite_pending_release(self):
        self.prepare()
        before = self.journal.read_bytes()
        with self.assertRaisesRegex(ValueError, 'Pending'):
            self.prepare()
        self.assertEqual(self.journal.read_bytes(), before)

    def test_later_job_version_is_rejected(self):
        self.prepare()
        self.live.job_version += 1
        with self.assertRaisesRegex(ValueError, 'next Nomad version'):
            self.validate()
        self.assertFalse(json.loads(self.journal.read_text())['registered'])

    def test_failed_registration_is_retained_without_retrying_mutation(self):
        self.prepare()
        self.live.job_version -= 1
        with self.assertRaisesRegex(ValueError, 'not registered'):
            self.validate()
        self.assertTrue(self.journal.exists())

    def test_manifest_drift_is_rejected(self):
        self.prepare()
        changed = self.original.to_mapping()
        changed['components']['frontend']['verification']['verified_at'] = '2026-01-01T00:00:00Z'
        self.manifest_path.write_text(self.state.StageManifest.from_mapping(changed).dump())
        with self.assertRaisesRegex(ValueError, 'manifest changed'):
            self.validate()

    def test_candidate_drift_is_rejected(self):
        self.prepare()
        self.require_exact_remote_stage.return_value = 'd' * 40
        with self.assertRaisesRegex(ValueError, 'candidate changed'):
            self.validate()

    def test_live_drift_is_rejected_and_index_stays_pinned(self):
        self.prepare()
        self.validate()
        before = self.journal.read_bytes()
        self.require_live_identity.side_effect = RuntimeError('live job modify index drift')
        with self.assertRaisesRegex(RuntimeError, 'drift'):
            self.validate()
        self.assertEqual(self.journal.read_bytes(), before)

    def test_record_failure_retains_journal(self):
        self.prepare()
        self.validate()
        with self.assertRaisesRegex(ValueError, 'not been recorded'):
            self.call('finish')
        self.assertTrue(self.journal.exists())

    def test_push_failure_retains_journal(self):
        self.prepare()
        self.validate()
        self.recorded()
        self.require_committed_remote_master.side_effect = RuntimeError('unpushed commit')
        with self.assertRaisesRegex(RuntimeError, 'unpushed'):
            self.call('finish')
        self.assertTrue(self.journal.exists())

    def test_successful_record_clears_only_pending_journal(self):
        self.prepare()
        self.validate()
        self.recorded()
        receipt = self.journal.parent / 'frontend-receipt.json'
        receipt.write_text('receipt')
        self.call('finish')
        self.assertFalse(self.journal.exists())
        self.assertEqual(receipt.read_text(), 'receipt')

    def publish_mocks(self, *, remote='c' * 40, paths='environments/stage/deployments.yaml'):
        head = 'd' * 40
        self.git_calls = []
        def git(runner, argv, repository, label):
            self.git_calls.append(argv)
            commands = {
                ('rev-parse', '--path-format=absolute', '--git-common-dir'): str(self.infra / '.git'),
                ('branch', '--show-current'): 'master',
                ('rev-parse', 'HEAD'): head,
                ('rev-parse', 'HEAD^'): 'c' * 40,
                ('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'): paths,
                ('push', 'origin', 'HEAD:refs/heads/master'): '',
            }
            if argv[1] == 'status':
                return ''
            return commands[tuple(argv[1:])]
        for name, kwargs in [
            ('_git_text', {'side_effect': git}),
            ('_fetch_branch', {'return_value': remote}),
            ('_acquire_manifest_transaction_lock', {'side_effect': lambda _: nullcontext()}),
            ('_validate_live_receipts', {'return_value': None}),
            ('_manifest_at_remote', {'side_effect': lambda repo, runner, sha:
                self.state.StageManifest.load(self.manifest_path) if sha == head else self.original}),
        ]:
            context = patch.object(self.guard, name, **kwargs)
            context.start()
            self.addCleanup(context.stop)

    def test_push_retry_only_pushes_exact_single_manifest_commit(self):
        self.prepare()
        self.validate()
        self.recorded()
        self.publish_mocks()
        self.call('publish')
        self.assertIn(['git', 'push', 'origin', 'HEAD:refs/heads/master'], self.git_calls)
        self.assertTrue(self.journal.exists())

    def test_push_retry_refuses_remote_history_drift(self):
        self.prepare()
        self.validate()
        self.recorded()
        self.publish_mocks(remote='e' * 40)
        with self.assertRaisesRegex(ValueError, 'history changed'):
            self.call('publish')
        self.assertFalse(any('push' in call for call in self.git_calls))

    def test_push_retry_refuses_commit_with_unrelated_files(self):
        self.prepare()
        self.validate()
        self.recorded()
        self.publish_mocks(paths='environments/stage/deployments.yaml\nother-file')
        with self.assertRaisesRegex(ValueError, 'unrelated changes'):
            self.call('publish')
        self.assertFalse(any('push' in call for call in self.git_calls))

    def test_atomic_write_failure_preserves_previous_state(self):
        self.prepare()
        before = self.journal.read_bytes()
        with patch.object(release.os, 'replace', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                release.atomic_json(self.journal, {'invalid': 'replacement'})
        self.assertEqual(self.journal.read_bytes(), before)
        self.assertEqual(list(self.journal.parent.glob('.release-*')), [])


if __name__ == '__main__':
    unittest.main()
