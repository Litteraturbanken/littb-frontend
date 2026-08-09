# Independent semantic review contract

Review exactly one generated semantic packet against the current repository. The packet is a bounded selection and context manifest, not a substitute for reading the code.

Inspect every owned unit, its direct imports and callers, its public and generated API type boundaries, and the listed tests. Run read-only inspection commands as needed. Do not modify the repository.

For the packet, answer:

1. Can any unit, branch, adapter, state, or abstraction be deleted?
2. Does it duplicate a domain concept, type, request builder, component responsibility, or validation rule?
3. Does each indirection enforce a policy, or merely move code without reducing complexity?
4. Are backend response types preserved to the consumer without avoidable `unknown`, casts, or parallel handwritten models?
5. Can SSR and client execution race, duplicate work, leak request state, or overwrite fresher state?
6. Are raw HTML, URL, storage, authentication, and sanitization boundaries explicit and safe?
7. Are interactive controls keyboard-operable, labelled, and represented by the correct semantic element?
8. Do tests protect observable behavior and failure boundaries rather than syntax, mocks, or implementation text?
9. Does the unit follow the simplest established local pattern, and what exact smaller implementation would preserve behavior?

Every finding must identify the packet, repository-relative path, owned unit ID, current line, severity, category, concrete consequence, evidence, and a specific safer or simpler alternative. Use `critical`, `important`, `minor`, or `question` severity. A metric, style preference, or speculative redesign is not evidence.

Packet fingerprints include owned physical line ranges as well as canonical source. Moving a reviewed unit therefore invalidates its evidence so every cited current line remains independently verifiable.

Return `approved` only when there are no unresolved Critical or Important findings. Distinguish confirmed defects, questions requiring product authority, and deterministic-tool false positives. The reviewer identity must differ from the implementation author recorded in the evidence.
