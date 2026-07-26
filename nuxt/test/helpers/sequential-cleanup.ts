export async function runSequentialCleanup(
  close: () => Promise<unknown>,
  reset: () => Promise<unknown>,
  message: string
): Promise<void> {
  const failures: unknown[] = []
  try {
    await close()
  } catch (error) {
    failures.push(error)
  }
  try {
    await reset()
  } catch (error) {
    failures.push(error)
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) throw new AggregateError(failures, message)
}
