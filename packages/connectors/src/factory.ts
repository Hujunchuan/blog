import { KnowledgeConnector, KnowledgeSource } from "../../core/src"
import { LocalFileConnector } from "./localConnector"

export function createKnowledgeConnector(source: KnowledgeSource): KnowledgeConnector {
  switch (source.type) {
    case "local":
      return new LocalFileConnector(source)
    case "github":
    case "server":
      throw new Error(`Connector not implemented yet for source type: ${source.type}`)
    default:
      throw new Error(`Unsupported source type: ${(source as KnowledgeSource).type}`)
  }
}
