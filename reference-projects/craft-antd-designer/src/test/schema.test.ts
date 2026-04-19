import { describe, expect, it } from 'vitest';
import { DEFAULT_APIS, DEFAULT_METHODS, DEFAULT_PAGE_STATE, createDefaultSerializedNodes } from '../app/schema/defaults';
import { appSchemaToSerializedNodes, buildAppSchema } from '../app/schema/helpers';

describe('schema conversion', () => {
  it('round-trips the craft nodes into AppSchema without losing event flows', () => {
    const serialized = createDefaultSerializedNodes();
    const schema = buildAppSchema(serialized, DEFAULT_PAGE_STATE, DEFAULT_METHODS, DEFAULT_APIS);
    const restored = appSchemaToSerializedNodes(schema);

    expect(restored.ROOT).toBeDefined();
    expect(restored['input-search']?.custom?.eventFlows).toHaveLength(1);
    expect(restored['button-search']?.custom?.eventFlows?.[0]?.eventName).toBe('onClick');
    expect(restored['table-users']?.props?.columns).toHaveLength(3);
  });
});
