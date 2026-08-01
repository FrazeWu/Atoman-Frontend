export function useRequestGeneration() {
  let currentGeneration = 0

  function beginRequest() {
    const generation = ++currentGeneration
    return {
      generation,
      isCurrent: () => generation === currentGeneration,
    }
  }

  function isCurrent(generation: number) {
    return generation === currentGeneration
  }

  return { beginRequest, isCurrent, currentGeneration: () => currentGeneration }
}
