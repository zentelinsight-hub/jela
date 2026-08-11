export const idempotencyKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateIdempotencyKey(value: string | null | undefined) {
  if (!value || !idempotencyKeyPattern.test(value)) {
    throw new Error('A valid idempotency key is required.');
  }
  return value.toLowerCase();
}

export function calculateCreditCharge(
  inputTokens: number,
  outputTokens: number,
  inputCostPerThousand: number,
  outputCostPerThousand: number,
) {
  if ([inputTokens, outputTokens, inputCostPerThousand, outputCostPerThousand].some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('Credit inputs must be non-negative finite numbers.');
  }
  return Math.ceil(
    (inputTokens / 1000) * inputCostPerThousand +
      (outputTokens / 1000) * outputCostPerThousand,
  );
}
