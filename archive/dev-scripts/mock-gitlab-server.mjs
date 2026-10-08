#!/usr/bin/env node
// Lightweight Mock GitLab API Server for newma testing
import http from 'http';

const PORT = 9876;
const TOKEN = 'mock-gitlab-token-12345';

const mockUser = { id: 1, username: 'root', name: 'Administrator' };

const mockMR = {
  id: 1, iid: 1, project_id: 1,
  title: 'feat: add GitLab integration',
  description: 'Add GitLab merge request review integration.',
  source_branch: 'feature/gitlab-integration',
  target_branch: 'main',
  state: 'opened',
  author: { id: 1, username: 'root', name: 'Administrator' },
};

const mockDiff = `diff --git a/src/gitlab/client.ts b/src/gitlab/client.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/gitlab/client.ts
@@ -0,0 +1,30 @@
+import fetch from 'node-fetch';
+
+export class GitLabClient {
+  private baseUrl: string;
+  private headers: Record<string, string>;
+
+  constructor(config: any) {
+    this.baseUrl = config.url.replace(/\\/+$/, '');
+    this.headers = {
+      'PRIVATE-TOKEN': config.token,
+      'Content-Type': 'application/json',
+    };
+  }
+
+  async getMRDetail(projectId: number, mrIid: number) {
+    const url = this.baseUrl + '/api/v4/projects/' + projectId + '/merge_requests/' + mrIid;
+    const response = await fetch(url, { method: 'GET', headers: this.headers });
+    if (!response.ok) {
+      throw new Error('GitLab API error: ' + response.status);
+    }
+    return await response.json();
+  }
+}`;

const mockDiff2 = `diff --git a/src/config.ts b/src/config.ts
index 1111111..2222222 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,6 +10,10 @@ export interface Config {
   apiKey: string;
   baseUrl: string;
   model: string;
+  maxRetries: number;
+  retryDelay: number;
 }`;

const mockChanges = [
  {
    old_path: 'src/gitlab/client.ts', new_path: 'src/gitlab/client.ts',
    diff: mockDiff, new_file: true, renamed_file: false, deleted_file: false,
  },
  {
    old_path: 'src/config.ts', new_path: 'src/config.ts',
    diff: mockDiff2, new_file: false, renamed_file: false, deleted_file: false,
  },
];

const mockRepoTree = [
  { id: 'a1', name: 'client.ts', type: 'blob', path: 'src/gitlab/client.ts' },
  { id: 'b2', name: 'types.ts', type: 'blob', path: 'src/gitlab/types.ts' },
  { id: 'c3', name: 'reviewer.ts', type: 'blob', path: 'src/gitlab/reviewer.ts' },
];

let noteId = 1;

function json(res, data, status) {
  status = status || 200;
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function err(res, status, msg) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: msg }));
}

function handle(req, res) {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  const path = url.pathname;
  const token = req.headers['private-token'];

  console.log(req.method + ' ' + path);

  // Skip auth for some endpoints
  if (path !== '/api/v4/version' && (!token || token !== TOKEN)) {
    return err(res, 401, 'Unauthorized');
  }

  // Collect body
  if (req.method === 'POST' || req.method === 'PUT') {
    let body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      req.body = body;
      route(req, res, path);
    });
  } else {
    route(req, res, path);
  }
}

function route(req, res, path) {
  // GET /api/v4/user
  if (req.method === 'GET' && path === '/api/v4/user') {
    return json(res, mockUser);
  }

  // GET /api/v4/version
  if (req.method === 'GET' && path === '/api/v4/version') {
    return json(res, { version: '16.0.0' });
  }

  // GET /api/v4/projects/:id/merge_requests/:iid
  var mrMatch = path.match(/^\/api\/v4\/projects\/(\d+)\/merge_requests\/(\d+)$/);
  if (req.method === 'GET' && mrMatch) {
    return json(res, mockMR);
  }
  if (req.method === 'PUT' && mrMatch) {
    var body = JSON.parse(req.body || '{}');
    console.log('  MR updated');
    return json(res, Object.assign({}, mockMR, body));
  }

  // GET /api/v4/projects/:id/merge_requests/:iid/diff
  var diffMatch = path.match(/^\/api\/v4\/projects\/(\d+)\/merge_requests\/(\d+)\/diff$/);
  if (req.method === 'GET' && diffMatch) {
    return json(res, mockChanges);
  }

  // GET /api/v4/projects/:id/merge_requests/:iid/changes
  var changesMatch = path.match(/^\/api\/v4\/projects\/(\d+)\/merge_requests\/(\d+)\/changes$/);
  if (req.method === 'GET' && changesMatch) {
    return json(res, Object.assign({}, mockMR, { changes: mockChanges }));
  }

  // POST /api/v4/projects/:id/merge_requests/:iid/notes
  var notesMatch = path.match(/^\/api\/v4\/projects\/(\d+)\/merge_requests\/(\d+)\/notes$/);
  if (req.method === 'POST' && notesMatch) {
    var body = JSON.parse(req.body || '{}');
    var note = { id: noteId++, body: body.body, created_at: new Date().toISOString() };
    console.log('  Note created: ' + (body.body || '').substring(0, 80) + '...');
    return json(res, note, 201);
  }

  // POST /api/v4/projects/:id/merge_requests/:iid/notes/:nid/notes
  var replyMatch = path.match(/^\/api\/v4\/projects\/(\d+)\/merge_requests\/(\d+)\/notes\/(\d+)\/notes$/);
  if (req.method === 'POST' && replyMatch) {
    var body = JSON.parse(req.body || '{}');
    return json(res, { id: noteId++, body: body.body }, 201);
  }

  // POST /api/v4/projects/:id/merge_requests/:iid/discussions
  var discMatch = path.match(/^\/api\/v4\/projects\/(\d+)\/merge_requests\/(\d+)\/discussions$/);
  if (req.method === 'POST' && discMatch) {
    var body = JSON.parse(req.body || '{}');
    console.log('  Discussion created');
    return json(res, { id: 'd1', notes: [{ id: noteId++, body: body.body }] }, 201);
  }

  // GET /api/v4/projects/:id/repository/files/*
  var fileMatch = path.match(/^\/api\/v4\/projects\/(\d+)\/repository\/files\/(.+)$/);
  if (req.method === 'GET' && fileMatch) {
    var filePath = decodeURIComponent(fileMatch[2]).split('?')[0];
    console.log('  File requested: ' + filePath);
    var content = Buffer.from('// mock: ' + filePath + '\n').toString('base64');
    return json(res, {
      content: content, encoding: 'base64',
      file_name: filePath.split('/').pop(), file_path: filePath,
    });
  }

  // GET /api/v4/projects/:id/repository/tree
  var treeMatch = path.match(/^\/api\/v4\/projects\/(\d+)\/repository\/tree$/);
  if (req.method === 'GET' && treeMatch) {
    return json(res, mockRepoTree);
  }

  // GET /api/v4/projects/:id
  var projMatch = path.match(/^\/api\/v4\/projects\/(\d+)$/);
  if (req.method === 'GET' && projMatch) {
    return json(res, { id: 1, name: 'newma-action', default_branch: 'main' });
  }

  console.log('  404: ' + req.method + ' ' + path);
  err(res, 404, 'Not Found: ' + path);
}

var server = http.createServer(handle);
server.listen(PORT, function() {
  console.log('');
  console.log('========================================');
  console.log('  Mock GitLab API Server');
  console.log('  URL:   http://localhost:' + PORT);
  console.log('  Token: ' + TOKEN);
  console.log('  Project ID: 1');
  console.log('  MR IID: 1');
  console.log('========================================');
  console.log('');
  console.log('Ready for newma testing!');
});
