import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { defineSettings, registerSettings, type SettingId, type SettingValues } from './settings.ts';

const general = () =>
	defineSettings().group('General', (g) =>
		g
			.add('Site_Url', { type: 'string', value: 'http://localhost:3000', public: true })
			.section('Iframe', (s) => s.add('Iframe_Restrict_Access', { type: 'boolean', value: true })),
	);

const accounts = () =>
	defineSettings().group('Accounts', (g) =>
		g
			.add('Accounts_AllowDeleteOwnAccount', { type: 'boolean', value: false })
			.add('Accounts_Theme', {
				type: 'select',
				values: [
					{ key: 'light', i18nLabel: 'Light' },
					{ key: 'dark', i18nLabel: 'Dark' },
				],
				value: 'light',
			})
			.add('Accounts_MaxSessions', { type: 'int', value: 5, enterprise: true, invalidValue: 0 }),
	);

describe('SettingsBuilder', () => {
	describe('add', () => {
		it('stores definitions in insertion order', () => {
			const settings = defineSettings()
				.add('B', { type: 'string', value: 'b' })
				.add('A', { type: 'int', value: 1 })
				.build();

			expect([...settings.keys()]).toEqual(['B', 'A']);
			expect(settings.get('A')).toEqual({ type: 'int', value: 1 });
		});

		it('throws on a duplicate id that bypasses the type check', () => {
			const builder = defineSettings().add('A', { type: 'boolean', value: true });

			expect(() =>
				// @ts-expect-error duplicate id
				builder.add('A', { type: 'boolean', value: false }),
			).toThrow('Duplicate setting id "A"');
		});

		it('does not mutate the builder it was called on', () => {
			const base = defineSettings().add('A', { type: 'boolean', value: true });
			const extended = base.add('B', { type: 'boolean', value: false });

			expect([...base.build().keys()]).toEqual(['A']);
			expect([...extended.build().keys()]).toEqual(['A', 'B']);
		});
	});

	describe('group / section', () => {
		it('applies group and section to the settings defined inside them', () => {
			const settings = general().build();

			expect(settings.get('Site_Url')).toMatchObject({ group: 'General' });
			expect(settings.get('Site_Url')).not.toHaveProperty('section');
			expect(settings.get('Iframe_Restrict_Access')).toMatchObject({ group: 'General', section: 'Iframe' });
		});

		it('restores the outer scope after the callback', () => {
			const settings = defineSettings()
				.group('G', (g) => g.add('Inside', { type: 'boolean', value: true }))
				.add('Outside', { type: 'boolean', value: true })
				.build();

			expect(settings.get('Inside')).toMatchObject({ group: 'G' });
			expect(settings.get('Outside')).not.toHaveProperty('group');
		});

		it('lets an explicit group on the definition win over the scope', () => {
			const settings = defineSettings()
				.group('G', (g) => g.add('A', { type: 'boolean', value: true, group: 'Other' }))
				.build();

			expect(settings.get('A')).toMatchObject({ group: 'Other' });
		});

		it('checks duplicates against settings defined outside the callback', () => {
			const builder = defineSettings().add('A', { type: 'boolean', value: true });

			expect(() =>
				builder.group('G', (g) =>
					// @ts-expect-error duplicate id inside a group
					g.add('A', { type: 'boolean', value: false }),
				),
			).toThrow('Duplicate setting id "A"');
		});
	});

	describe('merge', () => {
		it('combines fragments and keeps each fragment’s own groups', () => {
			const settings = general().merge(accounts()).build();

			expect([...settings.keys()]).toEqual([
				'Site_Url',
				'Iframe_Restrict_Access',
				'Accounts_AllowDeleteOwnAccount',
				'Accounts_Theme',
				'Accounts_MaxSessions',
			]);
			expect(settings.get('Accounts_Theme')).toMatchObject({ group: 'Accounts' });
		});

		it('allows the same fragment to be merged into several parents', () => {
			const shared = defineSettings().add('Shared', { type: 'string', value: 'x' });

			const a = defineSettings().add('A', { type: 'boolean', value: true }).merge(shared);
			const b = defineSettings().add('B', { type: 'boolean', value: true }).merge(shared);

			expect([...a.build().keys()]).toEqual(['A', 'Shared']);
			expect([...b.build().keys()]).toEqual(['B', 'Shared']);
			expect([...shared.build().keys()]).toEqual(['Shared']);
		});

		it('throws on overlapping ids', () => {
			expect(() =>
				// @ts-expect-error overlapping ids across fragments
				general().merge(defineSettings().add('Site_Url', { type: 'string', value: '' })),
			).toThrow('Duplicate setting id "Site_Url"');
		});

		it('throws when re-merging a fragment that is already included', () => {
			const all = general().merge(accounts());

			expect(() =>
				// @ts-expect-error accounts() is already part of `all`
				all.merge(accounts()),
			).toThrow('Duplicate setting id');
		});
	});

	describe('registerSettings', () => {
		it('registers each group once, before its settings, with value split from options', async () => {
			const calls: unknown[][] = [];
			const registry = {
				addGroup: vi.fn(async (id: string) => void calls.push(['addGroup', id])),
				add: vi.fn(async (id: string, value: unknown, options: Record<string, unknown>) => void calls.push(['add', id, value, options])),
			};

			await registerSettings(registry, general().merge(accounts()));

			expect(registry.addGroup).toHaveBeenCalledTimes(2);
			expect(calls.slice(0, 3)).toEqual([
				['addGroup', 'General'],
				['add', 'Site_Url', 'http://localhost:3000', { group: 'General', type: 'string', public: true }],
				['add', 'Iframe_Restrict_Access', true, { group: 'General', section: 'Iframe', type: 'boolean' }],
			]);
			expect(calls[3]).toEqual(['addGroup', 'Accounts']);
		});

		it('does not call addGroup for ungrouped settings', async () => {
			const registry = { addGroup: vi.fn(async () => {}), add: vi.fn(async () => {}) };

			await registerSettings(registry, defineSettings().add('A', { type: 'boolean', value: true }));

			expect(registry.addGroup).not.toHaveBeenCalled();
			expect(registry.add).toHaveBeenCalledWith('A', true, { type: 'boolean' });
		});
	});
});

// Checked only under `vitest --typecheck`; these are no-ops at runtime.
describe('types', () => {
	const all = general().merge(accounts());

	it('infers value types per setting', () => {
		expectTypeOf<SettingValues<typeof all>>().toEqualTypeOf<{
			Site_Url: string;
			Iframe_Restrict_Access: boolean;
			Accounts_AllowDeleteOwnAccount: boolean;
			Accounts_Theme: 'light' | 'dark';
			Accounts_MaxSessions: number;
		}>();
	});

	it('exposes the set of ids', () => {
		expectTypeOf<SettingId<typeof all>>().toEqualTypeOf<
			'Site_Url' | 'Iframe_Restrict_Access' | 'Accounts_AllowDeleteOwnAccount' | 'Accounts_Theme' | 'Accounts_MaxSessions'
		>();
	});

	it('rejects invalid definitions', () => {
		const dynamicId: string = 'X';

		// @ts-expect-error non-literal ids can't be checked for duplicates
		defineSettings().add(dynamicId, { type: 'string', value: '' });

		// @ts-expect-error value doesn't match type
		defineSettings().add('A', { type: 'int', value: 'five' });

		// @ts-expect-error enterprise setting without invalidValue
		defineSettings().add('A', { type: 'boolean', value: true, enterprise: true });

		// @ts-expect-error invalidValue of the wrong type
		defineSettings().add('A', { type: 'boolean', value: true, enterprise: true, invalidValue: 'no' });

		// @ts-expect-error select value not among declared keys
		defineSettings().add('A', { type: 'select', values: [{ key: 'a', i18nLabel: 'A' }], value: 'b' });
	});
});