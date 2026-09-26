export function assert(expectedCondition, message = "Assertion error") {
  if (!expectedCondition) throw Error(message)
}
