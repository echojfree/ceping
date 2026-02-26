export function applySchema(db) {
  db.run(`
    create table if not exists meta (
      key text primary key,
      value text not null
    );
  `);

  db.run(`
    create table if not exists users (
      id text primary key,
      email text not null unique,
      password_hash text not null,
      role text not null,
      display_name text,
      created_at text not null
    );
  `);

  db.run(`
    create table if not exists profiles (
      user_id text primary key,
      age_group text,
      education_stage text,
      school text,
      major text,
      grade text,
      updated_at text not null,
      foreign key(user_id) references users(id) on delete cascade
    );
  `);

  db.run(`
    create table if not exists assessments (
      id text primary key,
      slug text not null unique,
      title text not null,
      description text,
      kind text not null,
      config_json text not null,
      is_active integer not null,
      created_at text not null
    );
  `);

  db.run(`
    create table if not exists questions (
      id text primary key,
      assessment_id text not null,
      order_index integer not null,
      prompt text not null,
      type text not null,
      options_json text,
      scoring_json text not null,
      is_active integer not null,
      created_at text not null,
      foreign key(assessment_id) references assessments(id) on delete cascade
    );
  `);

  db.run(`
    create table if not exists results (
      id text primary key,
      user_id text,
      assessment_id text not null,
      age_group text,
      raw_json text not null,
      riasec_json text not null,
      skills_json text,
      code text not null,
      recommendations_json text not null,
      created_at text not null,
      foreign key(user_id) references users(id) on delete set null,
      foreign key(assessment_id) references assessments(id) on delete cascade
    );
  `);
}
