export interface Schema {
  "assets": string[] | AssetPatternClass[] | SingleAssetPatternClass[],
  "project": string,
  "tsConfig": string,
  "watch": boolean
}

export interface AssetPatternClass {
  "glob": string,
  "input": string,
  "ignore"?: string[],
  "output": string
}

export interface SingleAssetPatternClass {
  "inputFile": string,
  "outputFile": string
}
