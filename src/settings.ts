/* ------------------------------------------------------------------ *
 * Setting definitions
 * ------------------------------------------------------------------ */
 
type SettingValueMap = {
	boolean: boolean;
	string: string;
	int: number;
	password: string;
	code: string;
	select: string;
};
 
export type SettingType = keyof SettingValueMap;
 
type BaseOptions = {
	public?: boolean;
	i18nLabel?: string;
	i18nDescription?: string;
	sorter?: number;
	group?: string;
	section?: string;
};
 
// Enterprise settings MUST declare an invalidValue (the old registry only checked this at runtime).
type EnterpriseOptions<V> =
	| { enterprise?: false; invalidValue?: never; modules?: never }
	| { enterprise: true; invalidValue: V; modules?: readonly string[] };
 
type ScalarType = Exclude<SettingType, 'select'>;
 
type ScalarDefinition = {
	[K in ScalarType]: { type: K; value: SettingValueMap[K] } & BaseOptions & EnterpriseOptions<SettingValueMap[K]>;
}[ScalarType];
 
export type SelectOption = { readonly key: string; readonly i18nLabel: string };
 
type SelectDefinition = {
	type: 'select';
	values: readonly SelectOption[];
	value: string;
} & BaseOptions &
	EnterpriseOptions<string>;
 
export type SettingDefinition = ScalarDefinition | SelectDefinition;
 
/* ------------------------------------------------------------------ *
 * Type-level checks
 *
 * Each check resolves to `unknown` when valid (so `X & unknown = X`),
 * or to an object carrying a readable error message when invalid, which
 * makes the argument unassignable and surfaces the message in the error.
 * ------------------------------------------------------------------ */
 
type Simplify<T> = { [K in keyof T]: T[K] } & {};

type Invalid<T extends string> = { __error: T };
 
type IdCheck<K extends string, T> = string extends K
	? Invalid<'Setting id must be a string literal'>
	: K extends keyof T
		? Invalid<`Duplicate setting id "${K}"`>
		: unknown;
 
type DefinitionCheck<D> = D extends { type: 'select'; values: readonly { key: infer K }[]; value: infer V }
	? [V] extends [K]
		? unknown
		: Invalid<`Select value "${V & string}" is not one of the declared keys`>
	: unknown;
 
type MergeCheck<A, B> = [Extract<keyof A, keyof B>] extends [never]
	? unknown
	: Invalid<`Duplicate setting ids: ${Extract<keyof A, keyof B> & string}`>;
 
/* ------------------------------------------------------------------ *
 * Builder
 * ------------------------------------------------------------------ */
 
type Scope = { group?: string; section?: string };
 
/**
 * Immutable: every call returns a new builder, so a fragment can be merged
 * into several parents without shared mutable state.
 */
export class SettingsBuilder<T extends object = {}> {
	/** Phantom field carrying the accumulated settings type. Never set at runtime. */
	declare readonly '~settings': T;

    private readonly entries: ReadonlyMap<string, SettingDefinition>;
    private readonly scope: Scope;
 
	private constructor(
		entries: ReadonlyMap<string, SettingDefinition>,
		scope: Scope,
	) {
        this.entries = entries;
        this.scope = scope;
    }
 
	static create(): SettingsBuilder<{}> {
		return new SettingsBuilder<{}>(new Map(), {});
	}
 
	add<const K extends string, const D extends SettingDefinition>(
		id: K & IdCheck<K, T>,
		definition: D & DefinitionCheck<D>,
	): SettingsBuilder<T & { [P in K]: D }> {
		if (this.entries.has(id)) {
			// Runtime guard for anything that slipped past the types (casts, `any`).
			throw new Error(`Duplicate setting id "${id}"`);
		}
		const entries = new Map(this.entries);
		entries.set(id, { ...this.scope, ...definition });
		return new SettingsBuilder<T & { [P in K]: D }>(entries, this.scope);
	}
 
	group<U extends T>(group: string, fn: (builder: SettingsBuilder<T>) => SettingsBuilder<U>): SettingsBuilder<U> {
		return this.scoped({ group }, fn);
	}
 
	section<U extends T>(section: string, fn: (builder: SettingsBuilder<T>) => SettingsBuilder<U>): SettingsBuilder<U> {
		return this.scoped({ ...this.scope, section }, fn);
	}
 
	merge<U extends object>(other: SettingsBuilder<U> & MergeCheck<T, U>): SettingsBuilder<T & U> {
		const entries = new Map(this.entries);
		for (const [id, definition] of other.entries) {
			if (entries.has(id)) {
				throw new Error(`Duplicate setting id "${id}"`);
			}
			entries.set(id, definition);
		}
		return new SettingsBuilder<T & U>(entries, this.scope);
	}
 
	build(): ReadonlyMap<keyof T & string, SettingDefinition> {
		return this.entries as ReadonlyMap<keyof T & string, SettingDefinition>;
	}
 
	private scoped<U extends T>(scope: Scope, fn: (builder: SettingsBuilder<T>) => SettingsBuilder<U>): SettingsBuilder<U> {
		const result = fn(new SettingsBuilder<T>(this.entries, scope));
		// Restore the outer scope so later calls on the chain aren't affected.
		return new SettingsBuilder<U>(result.entries, this.scope);
	}
}
 
export const defineSettings = SettingsBuilder.create;
 
/* ------------------------------------------------------------------ *
 * Inference helpers
 * ------------------------------------------------------------------ */
 
export type InferSettings<B> = B extends SettingsBuilder<infer T> ? Simplify<T> : never;
 
type ValueOf<D> = D extends { type: 'select'; values: readonly { key: infer K }[] }
	? K
	: D extends { type: infer Ty extends SettingType }
		? SettingValueMap[Ty]
		: never;
 
/** `{ Site_Url: string; Accounts_Theme: 'light' | 'dark'; ... }` */
export type SettingValues<B> = { [K in keyof InferSettings<B>]: ValueOf<InferSettings<B>[K]> };
 
export type SettingId<B> = keyof InferSettings<B> & string;
 
/* ------------------------------------------------------------------ *
 * Adapter to the existing SettingsRegistry
 * ------------------------------------------------------------------ */
 
type RegistryLike = {
	addGroup(id: string): Promise<void>;
	add(id: string, value: unknown, options: Record<string, unknown>): Promise<void>;
};
 
export async function registerSettings<T extends object>(registry: RegistryLike, builder: SettingsBuilder<T>): Promise<void> {
	const seenGroups = new Set<string>();
	for (const [id, { value, ...options }] of builder.build()) {
		if (options.group && !seenGroups.has(options.group)) {
			seenGroups.add(options.group);
			await registry.addGroup(options.group);
		}
		await registry.add(id, value, options);
	}
}
 
