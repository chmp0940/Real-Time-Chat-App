import path from "node:path";
import fs from "node:fs";
import { logger } from "../lib/logger.js";
import { query } from "./db.js";



const migrateDir=path.resolve(process.cwd(),'src','migrations');

async function runMigrations()
{
  logger.info(
    `Looking for migration in ${migrateDir}`
  )

  const files=fs.readdirSync(migrateDir).filter(file=>file.endsWith('.sql')).sort();

  if(files.length===0)
  {
    logger.info("No migration files found.");
    return;
  }

  for(const file of files)
  {
    const fullPath=path.join(migrateDir,file);
    const sql=fs.readFileSync(fullPath,'utf-8');
    logger.info(`Running migration`);

    await query(sql);
    logger.info(`Migration ${file} ran successfully`);
  }

}

runMigrations().then(()=>{
  logger.info('All migrations ran successfully');
  process.exit(0);
}).catch((error)=>{ 
  logger.error(`Error running migrations: ${error.message}`);
  process.exit(1);
})