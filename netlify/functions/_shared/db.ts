import { getConnectionString } from '@netlify/database';
import postgres from 'postgres';
let client:ReturnType<typeof postgres>|undefined;
export function database(){
  if(client) return client;
  const connectionString=process.env.DATABASE_URL||process.env.NETLIFY_DB_URL||getConnectionString();
  client=postgres(connectionString,{max:2,idle_timeout:20,connect_timeout:10,prepare:false});
  return client;
}
