import { drizzle } from 'drizzle-orm/d1';

export interface Env {
    d1db: D1Database;
}
export default {
    async fetch(request: Request, env: Env) {
        const db = drizzle(env.d1db);
    },
};
