/**
 * Read a fetch response without allowing an upstream server to exhaust memory.
 * The byte count is enforced while streaming because Content-Length is optional
 * and cannot be trusted on its own.
 */
export async function readBoundedResponse(response, maximumBytes, { tooLarge, interrupted }) {
  if (!response.body) throw interrupted();

  const sizeLimitError = tooLarge();
  const chunks = [];
  let totalBytes = 0;

  try {
    for await (const chunk of response.body) {
      const bytes = Buffer.from(chunk);
      totalBytes += bytes.length;
      if (totalBytes > maximumBytes) throw sizeLimitError;
      chunks.push(bytes);
    }
  } catch (error) {
    if (error === sizeLimitError) throw error;
    throw interrupted();
  }

  return Buffer.concat(chunks, totalBytes);
}
