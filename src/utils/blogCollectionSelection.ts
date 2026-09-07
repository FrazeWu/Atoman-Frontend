type CollectionOption = {
  id: string
  is_default?: boolean
}

export function normalizeBlogCollectionSelection(
  collections: CollectionOption[],
  selectedCollectionId: string | null | undefined,
) {
  const selectedCollection = collections.find(collection => collection.id === selectedCollectionId)
  if (selectedCollection) return [selectedCollection.id]

  const defaultCollection = collections.find(collection => collection.is_default)
  return defaultCollection ? [defaultCollection.id] : []
}
