import {drizzle} from 'drizzle-orm/d1';

export const db = (env: any) => {
    const envVar = env as Cloudflare.Env
    return drizzle(envVar.database);
}
