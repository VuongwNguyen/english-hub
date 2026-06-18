import { syncSentencesFromTatoeba } from './external/sync-sentences'

syncSentencesFromTatoeba()
  .then((result) => {
    console.log(result)
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
