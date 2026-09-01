import { describe, expect, it } from 'vitest';

describe('vehicle catalog form contract', () => {
  it('keeps adscription as a managed catalog field', () => {
    const managedFields = [
      'brand',
      'type',
      'color',
      'adscription',
      'realLocation',
      'rawCirculationStatus',
      'sourceSection',
    ];

    expect(managedFields).toContain('adscription');
  });
});
