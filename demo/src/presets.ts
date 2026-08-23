export interface Preset {
  name: string;
  source: string;
}

// Macros drawn only from docs/dsl-reference.md in the source repo (the
// parser's verified, hand-maintained macro table) — not invented syntax.
export const PRESETS: Preset[] = [
  {
    name: 'Plain context',
    source: `Person(user, "User", "A person using the system")
System(app, "App", "Does the thing the user wants")
Rel(user, app, "Uses", "HTTPS")
`,
  },
  {
    name: 'Nested boundaries',
    source: `Person(user, "User", "A person using the system")

System_Boundary(platform, "Platform") {
  Container_Boundary(api, "API") {
    Container(web, "Web Service", "Node.js", "Serves HTTP requests")
    Container(worker, "Worker", "Node.js", "Processes background jobs")
  }
  Container(cache, "Cache", "Redis", "Shared cache")
}

Rel(user, web, "Uses", "HTTPS")
Rel(web, worker, "Enqueues jobs")
Rel(web, cache, "Reads/writes")
Rel(worker, cache, "Reads/writes")
`,
  },
  {
    name: 'Db / Queue shapes',
    source: `Person(user, "User", "A person using the system")

System_Boundary(platform, "Platform") {
  Container(api, "API", "Node.js", "Handles requests")
  ContainerDb(db, "Database", "PostgreSQL", "Stores application data")
  ContainerQueue(queue, "Queue", "RabbitMQ", "Decouples background work")
}

Rel(user, api, "Uses", "HTTPS")
Rel(api, db, "Reads/writes", "SQL")
Rel(api, queue, "Publishes to", "AMQP")
`,
  },
  {
    name: 'External elements',
    source: `Person(user, "User", "A person using the system")
Person_Ext(support, "Support Agent", "Third-party support staff")

System(app, "App", "Does the thing the user wants")
System_Ext(email, "Email Provider", "Sends transactional email")

Rel(user, app, "Uses", "HTTPS")
Rel(support, app, "Administers", "HTTPS")
Rel(app, email, "Sends email via", "SMTP")
`,
  },
];
