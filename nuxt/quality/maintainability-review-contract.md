# Independent maintainability review contract

The generated review packet ranks code units that deterministic analyzers have discovered. The packet is a selection mechanism, not a verdict. Review the current implementation, its callers, its tests, and the closest established local pattern before making a finding.

For every selected unit, answer these questions:

1. Can this unit or an abstraction inside it be deleted?
2. Does it duplicate a domain concept, type, adapter, or branch?
3. Is indirection enforcing policy or merely moving code?
4. Does it follow the simplest established local pattern?
5. What exact smaller implementation preserves behavior?

Every observation must cite the repository-relative path, named symbol, and current line evidence. Distinguish a confirmed defect from a question or a tooling false positive. Do not infer behavior from a metric alone.

The authoring agent cannot approve its own implementation. A review is independent only when another reviewer examines the packet and current source. AI observations are advisory: they do not become a blocking rule until a human confirms the recurring pattern and the team encodes it as a deterministic test, analyzer rule, or architecture policy.

Do not suppress an analyzer for a named file. When evidence is incorrect, first reproduce the false positive, then repair the shared adapter, configuration, or rule with a failing test.
