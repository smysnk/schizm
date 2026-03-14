import type { Queryable } from "../db/pool";
import { query, withTransaction } from "../db/pool";

export type IdeaNode = {
  id: string;
  title: string;
  description: string;
  cluster: string;
  x: number;
  y: number;
  radius: number;
  weight: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type Connection = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  strength: number;
  createdAt: string;
};

export type GraphSnapshot = {
  generatedAt: string;
  ideas: IdeaNode[];
  connections: Connection[];
};

type IdeaRow = {
  id: string;
  title: string;
  description: string;
  cluster: string;
  x: number;
  y: number;
  radius: number;
  weight: number;
  tags: string[];
  created_at: Date;
  updated_at: Date;
};

type ConnectionRow = {
  id: string;
  source_id: string;
  target_id: string;
  label: string;
  strength: number;
  created_at: Date;
};

const toIdeaNode = (row: IdeaRow): IdeaNode => ({
  id: row.id,
  title: row.title,
  description: row.description,
  cluster: row.cluster,
  x: row.x,
  y: row.y,
  radius: row.radius,
  weight: row.weight,
  tags: row.tags || [],
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString()
});

const toConnection = (row: ConnectionRow): Connection => ({
  id: row.id,
  sourceId: row.source_id,
  targetId: row.target_id,
  label: row.label,
  strength: row.strength,
  createdAt: row.created_at.toISOString()
});

const demoIdeas = [
  {
    title: "Raw Signal",
    description: "The first unstable fragment. Usually sensory, emotional, and hard to classify.",
    cluster: "signal",
    x: -260,
    y: -80,
    radius: 86,
    weight: 4,
    tags: ["origin", "intuition"]
  },
  {
    title: "Observation Log",
    description: "A record of patterns, timestamps, and repeated motifs that deserve scrutiny.",
    cluster: "analysis",
    x: -60,
    y: 160,
    radius: 74,
    weight: 3,
    tags: ["evidence", "trace"]
  },
  {
    title: "Personal Myth",
    description: "The narrative layer that gives stray details meaning and emotional gravity.",
    cluster: "narrative",
    x: 60,
    y: -180,
    radius: 82,
    weight: 4,
    tags: ["story", "identity"]
  },
  {
    title: "Counter Evidence",
    description: "The friction that keeps the map honest and stops a theory from sealing shut.",
    cluster: "analysis",
    x: 280,
    y: -20,
    radius: 70,
    weight: 3,
    tags: ["challenge", "reality-check"]
  },
  {
    title: "Prototype Ritual",
    description: "A small experiment that turns a theory into a repeatable behavior or process.",
    cluster: "action",
    x: 200,
    y: 210,
    radius: 78,
    weight: 3,
    tags: ["test", "practice"]
  }
];

const demoConnections = [
  { sourceTitle: "Raw Signal", targetTitle: "Observation Log", label: "records", strength: 0.82 },
  { sourceTitle: "Raw Signal", targetTitle: "Personal Myth", label: "activates", strength: 0.9 },
  { sourceTitle: "Observation Log", targetTitle: "Counter Evidence", label: "surfaces", strength: 0.76 },
  { sourceTitle: "Personal Myth", targetTitle: "Prototype Ritual", label: "inspires", strength: 0.72 },
  { sourceTitle: "Counter Evidence", targetTitle: "Prototype Ritual", label: "sharpens", strength: 0.67 },
  { sourceTitle: "Observation Log", targetTitle: "Prototype Ritual", label: "guides", strength: 0.61 }
];

const listIdeas = async (db: Queryable) => {
  const result = await db.query<IdeaRow>(`
    SELECT id, title, description, cluster, x, y, radius, weight, tags, created_at, updated_at
    FROM ideas
    ORDER BY created_at ASC
  `);

  return result.rows.map(toIdeaNode);
};

const listConnections = async (db: Queryable) => {
  const result = await db.query<ConnectionRow>(`
    SELECT id, source_id, target_id, label, strength, created_at
    FROM connections
    ORDER BY created_at ASC
  `);

  return result.rows.map(toConnection);
};

export const ensureDemoGraph = async () => {
  await withTransaction(async (client) => {
    const existing = await client.query<{ total: string }>("SELECT COUNT(*)::text AS total FROM ideas");
    const total = Number(existing.rows[0]?.total || 0);

    if (total > 0) {
      return;
    }

    const ids = new Map<string, string>();

    for (const idea of demoIdeas) {
      const inserted = await client.query<{ id: string }>(
        `
          INSERT INTO ideas (title, description, cluster, x, y, radius, weight, tags)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `,
        [
          idea.title,
          idea.description,
          idea.cluster,
          idea.x,
          idea.y,
          idea.radius,
          idea.weight,
          idea.tags
        ]
      );

      ids.set(idea.title, inserted.rows[0].id);
    }

    for (const connection of demoConnections) {
      await client.query(
        `
          INSERT INTO connections (source_id, target_id, label, strength)
          VALUES ($1, $2, $3, $4)
        `,
        [
          ids.get(connection.sourceTitle),
          ids.get(connection.targetTitle),
          connection.label,
          connection.strength
        ]
      );
    }
  });
};

export const getGraphSnapshot = async (): Promise<GraphSnapshot> => {
  const ideas = await listIdeas({ query });
  const connections = await listConnections({ query });

  return {
    generatedAt: new Date().toISOString(),
    ideas,
    connections
  };
};

export const moveIdea = async (
  id: string,
  x: number,
  y: number
): Promise<IdeaNode> => {
  const result = await query<IdeaRow>(
    `
      UPDATE ideas
      SET x = $2,
          y = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, title, description, cluster, x, y, radius, weight, tags, created_at, updated_at
    `,
    [id, x, y]
  );

  if (!result.rowCount) {
    throw new Error(`Idea ${id} not found`);
  }

  return toIdeaNode(result.rows[0]);
};
