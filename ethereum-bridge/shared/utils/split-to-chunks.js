
export default function splitToChunks(chunkSize, arrays) {
  let result = arrays.map(arr => [])
  let done = false

  for (let iChunk = 0; !done; ++iChunk) {
    const iLeft = iChunk * chunkSize
    const iRight = iLeft + chunkSize

    done = true

    for (let iArr = 0; iArr < arrays.length; ++iArr) {
      const arr = arrays[iArr]
      if (iLeft < arr.length) {
        done = false
        result[iArr].push(arr.slice(iLeft, iRight))
      }
    }
  }

  return result
}
