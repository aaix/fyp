import { useState, useEffect } from 'react'

/**
 * Returns a value that updates only after the source value has been stable for `delay` ms.
 * Useful for debouncing search input, resize handlers, etc.
 *
 * @param {T} value - The value to debounce (e.g. input text).
 * @param {number} delay - Delay in milliseconds (e.g. 300 for search).
 * @returns {T} - The debounced value.
 */
export function useDebouncedValue(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
