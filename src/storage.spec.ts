import { describe, it, expect } from 'vitest';

import { memoryStorage, moveItem } from './storage.ts';

describe('memoryStorage', () => {
    it('should set and get items', () => {
        memoryStorage.setItem('key1', 'value1');
        expect(memoryStorage.getItem('key1')).toBe('value1');
    });

    it('should remove items', () => {
        memoryStorage.setItem('key2', 'value2');
        memoryStorage.removeItem('key2');
        expect(memoryStorage.getItem('key2')).toBeNull();
    });

    it('should clear all items', () => {
        memoryStorage.setItem('key3', 'value3');
        memoryStorage.setItem('key4', 'value4');
        memoryStorage.clear();
        expect(memoryStorage.getItem('key3')).toBeNull();
        expect(memoryStorage.getItem('key4')).toBeNull();
    });

    it('should return the correct length', () => {
        memoryStorage.clear();
        expect(memoryStorage.length).toBe(0);
        memoryStorage.setItem('key5', 'value5');
        expect(memoryStorage.length).toBe(1);
    });

    it('should return the correct key by index', () => {
        memoryStorage.clear();
        memoryStorage.setItem('key6', 'value6');
        memoryStorage.setItem('key7', 'value7');
        expect(memoryStorage.key(0)).toBe('key6');
        expect(memoryStorage.key(1)).toBe('key7');
        expect(memoryStorage.key(2)).toBeNull();
    });

    it('should coerce keys and values to strings', ({}) => {
        memoryStorage.setItem(
            cast(123),
            cast(456)
        );
        expect(memoryStorage.getItem('123')).toBe('456');
    });
});

describe('moveItem', () => {
    it('should move an item from source to destination', () => {
        const source = localStorage;
        const destination = sessionStorage;

        source.setItem('key1', 'value1');
        moveItem(source, destination, 'key1');

        expect(source.getItem('key1')).toBeNull();
        expect(destination.getItem('key1')).toBe('value1');
    });

    it('should do nothing if the key does not exist in the source', () => {
        const source = localStorage;
        const destination = sessionStorage;

        source.removeItem('nonexistentKey');
        moveItem(source, destination, 'nonexistentKey');

        expect(source.getItem('nonexistentKey')).toBeNull();
        expect(destination.getItem('nonexistentKey')).toBeNull();
    });


});

function cast<T>(value: unknown): T {
    return value as T;
}