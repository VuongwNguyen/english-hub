import { runSyncWorker } from './external/run-sync-worker'

runSyncWorker()
  .then((result) => {
    console.log(result)
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
