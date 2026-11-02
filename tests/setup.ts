// Local runs read .env; CI provides the variables directly.
import { existsSync } from 'node:fs'
if (existsSync('.env')) process.loadEnvFile('.env')
