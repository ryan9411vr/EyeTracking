// src/utilities/validation.ts

/**
 * Validates whether a given string conforms to the Host:Port format.
 *
 * Host may be an IPv4 address or a DNS hostname (e.g. "openiristracker.local").
 * - If the host consists only of digits and dots, it must be a valid IPv4 address
 *   (four octets, each 0 to 255), so typos like "999.1.1.1" are rejected.
 * - Otherwise it is treated as a hostname with any number of dot-separated labels
 *   (e.g. "left.eye.tracker.home.lan"). Each label must be 1 to 63 characters of
 *   letters, digits, hyphens, or underscores, and may not start or end with a hyphen.
 *   The whole hostname may be at most 253 characters. Underscores are not standard
 *   but are allowed because some routers and mDNS setups use them.
 * PORT is one or more digits.
 *
 * NOTE: IPv6 addresses are not supported.
 *
 * @param hostPort - The string to validate, expected in "Host:Port" format.
 * @returns True if the string is a valid Host:Port, false otherwise.
 */
export function isValidHostPort(hostPort: string): boolean {
  const trimmed = hostPort.trim();
  const match = /^(.+):(\d+)$/.exec(trimmed);
  if (!match) return false;
  const host = match[1];

  if (/^[\d.]+$/.test(host)) {
    const ipv4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
    return ipv4.test(host);
  }

  if (host.length > 253) return false;
  const label = /^[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?$/;
  return host.split('.').every((part) => label.test(part));
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
 * Validates whether a given string conforms to a valid UVC index.
 *
 * The expected format is "<number>", where:
 * - <number> is one or more digits.
 *
 * @param uvcIndex - The string to validate.
 * @returns True if the string is a valid UVC index, false otherwise.
 */
export function isValidUvcIndex(uvcIndex: string): boolean {
  const trimmed = uvcIndex.trim();
  const regex = /^\d+$/;
  return regex.test(trimmed);
}

/**
 * Determines whether a given string is a valid COM port, a valid Host:Port endpoint, a valid UVC index, or neither.
 *
 * It uses isValidComPort() for COM port validation, isValidHostPort() for Host:Port validation
 * (IPv4 or DNS hostname), and isValidUvcIndex() for UVC index validation.
 *
 * @param input - The string to validate.
 * @returns "COM" if the string is a valid COM port, "IP" if it is a valid Host:Port, "UVC" if the string is a valid UVC index, or "Neither" otherwise.
 */
export function determinePortType(input: string): 'COM' | 'IP' | 'UVC' | 'Neither' {
  if (isValidComPort(input)) {
    return 'COM';
  } else if (isValidHostPort(input)) {
    return 'IP';
  } else if (isValidUvcIndex(input)) {
    return 'UVC';
  }
  return 'Neither';
}
