export class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  /**
   * Returns the number of key/value pairs currently present.
   */
  get length(): number {
    return this.data.size;
  }

  /**
   * Empties the list associated with the object of all key/value pairs, if there are any.
   */
  clear(): void {
    this.data.clear();
  }

  /**
   * Returns the current value associated with the given key, or null if the given key does not exist.
   */
  getItem(key: string): string | null {
    // The Storage API specification dictates that keys are coerced to strings
    const strKey = String(key);
    return this.data.has(strKey) ? this.data.get(strKey)! : null;
  }

  /**
   * Returns the name of the nth key in the list, or null if n is greater
   * than or equal to the number of key/value pairs in the object.
   */
  key(index: number): string | null {
    if (index < 0 || index >= this.data.size) {
      return null;
    }
    // Convert IterableIterator to Array to access by index
    const keys = Array.from(this.data.keys());
    return keys[index] ?? null;
  }

  /**
   * Removes the key/value pair with the given key from the list associated with the object,
   * if a key/value pair with the given key exists.
   */
  removeItem(key: string): void {
    this.data.delete(String(key));
  }

  /**
   * Sets the value of the pair identified by key to value, creating a new key/value pair if none existed for key previously.
   */
  setItem(key: string, value: string): void {
    // The Storage API specification dictates that both keys and values are coerced to strings
    this.data.set(String(key), String(value));
  }
}

// Export a singleton instance if you want it to act exactly like the global `localStorage`
export const memoryStorage = new MemoryStorage();

export function moveItem(source: Storage, destination: Storage, key: string): void {
    const value = source.getItem(key);
    if (value !== null) {
        destination.setItem(key, value);
        source.removeItem(key);
    }
}