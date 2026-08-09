export type CatalogSourceInfoIdentity = {
  authorId: string
  titlePath: string
}

export function catalogSourceInfoKey(identity: CatalogSourceInfoIdentity): string {
  return JSON.stringify([identity.authorId, identity.titlePath])
}
