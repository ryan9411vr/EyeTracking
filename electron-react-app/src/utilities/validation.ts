// src/utilities/validation.ts

/**
 * Validates whether a given string conforms to the IPv4:Port format.
 *
 * The expected format is "A.B.C.D:PORT", where:
 * - A, B, C, and D are integers from 0 to 255 (representing a valid IPv4 address).
 * - PORT is a sequence of one or more digits.
 *
 * NOTE:
 * - The port is validated only as a numeric string; its value is not constrained to the
 *   typical valid range (e.g., 1 to 65535).
 * - IPv6 addresses are not supported.
 *
 * @param ipPort - The string to validate, expected in "IP:Port" format.
 * @returns True if the string is a valid IPv4:Port, false otherwise.
 */
export function isValidIpPort(ipPort: string): boolean {
  const trimmed = ipPort.trim();
  const regex = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d):\d+$/;
  return regex.test(trimmed);
}

/**
 * Validates whether a given string conforms to a valid COM port format.
 *
 * The expected format is "COM<number>", where:
 * - "COM" is case-insensitive.
 * - <number> is one or more digits.
 *
 * @param comPort - The string to validate.
 * @returns True if the string is a valid COM port, false otherwise.
 */
export function isValidComPort(comPort: string): boolean {
  const trimmed = comPort.trim();
  const regex = /^COM\d+$/i;
  return regex.test(trimmed);
}

/**
 * Determines whether a given string is a valid COM port, a valid IPv4:Port endpoint, or neither.
 *
 * It uses isValidComPort() for COM port validation and isValidIpPort() for IP:Port validation.
 *
 * @param input - The string to validate.
 * @returns "COM" if the string is a valid COM port, "IP" if it is a valid IPv4:Port, or "Neither" otherwise.
 */
export function determinePortType(input: string): 'COM' | 'IP' | 'Neither' {
  if (isValidComPort(input)) {
    return 'COM';
  } else if (isValidIpPort(input)) {
    return 'IP';
  }
  return 'Neither';
}
