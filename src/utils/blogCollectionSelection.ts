type CollectionOption = {
  id: string
  is_default?: boolean
}

export function normalizeBlogCollectionSelection(
  collections: CollectionOption[],
  ordinaryCollectionId: string | null | undefined,
) {
  const defaultCollection = collections.find(collection => collection.is_default)
  if (!defaultCollection) return []

  const ordinaryCollection = collections.find(collection => (
    collection.id === ordinaryCollectionId && !collection.is_default
  ))
  return ordinaryCollection
    ? [defaultCollection.id, ordinaryCollection.id]
    : [defaultCollection.id]
}
