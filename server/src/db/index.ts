import {drizzle} from 'drizzle-orm/d1';

export const db = (env: unknown) => {
    const envVar= env as Cloudflare.Env
    return drizzle(envVar.database);
}
