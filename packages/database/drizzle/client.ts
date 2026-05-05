import { env } from "@repo/env";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Check the drizzle documentation for more information on how to connect to your preferred database provider
// https://orm.drizzle.team/docs/get-started-postgresql

function createDatabaseClient() {
	const databaseUrl = env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error(
			"DATABASE_URL is required to initialize database client",
		);
	}

	return drizzle(databaseUrl, { schema });
}

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

let client: DatabaseClient | null = null;

function getDatabaseClient() {
	client ??= createDatabaseClient();
	return client;
}

export const db = new Proxy({} as DatabaseClient, {
	get(_target, property, receiver) {
		const database = getDatabaseClient();
		const value = Reflect.get(database, property, receiver);

		return typeof value === "function" ? value.bind(database) : value;
	},
});
