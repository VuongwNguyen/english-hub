import { generateLessonsFromCachedData } from './external/generate-lessons-from-cache'

generateLessonsFromCachedData()
  .then((result) => {
    console.log(result)
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
