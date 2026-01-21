const { sendJson, sendNoContent } = require('../http/response');
const { readJsonBody } = require('../http/request');

async function handleTasksList(res, url, storage) {
  const filters = {};
  const status = url.searchParams.get('status');
  const domain = url.searchParams.get('domain');
  const excludeCompleted = url.searchParams.get('excludeCompleted') === 'true';

  if (status) {
    filters.status = status.split(',');
  }
  if (domain) {
    filters.domain = domain;
  }
  if (excludeCompleted) {
    filters.excludeCompleted = true;
  }

  const tasks = storage.listTasks(filters);

  const groups = {};
  tasks.forEach((task) => {
    if (!groups[task.domain]) {
      groups[task.domain] = [];
    }
    groups[task.domain].push(task);
  });

  const stats = {
    total: tasks.length,
    pending: tasks.filter((task) => task.status === 'pending').length,
    running: tasks.filter((task) => task.status === 'running').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    failed: tasks.filter((task) => task.status === 'failed').length,
  };

  sendJson(res, 200, { tasks, groups, stats });
}

async function handleTaskCreate(req, res, storage) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }

  if (!body.url) {
    return sendJson(res, 400, { error: 'url_required' });
  }

  try {
    const task = await storage.createTask({
      url: body.url,
      options: body.options || {},
    });
    sendJson(res, 201, { task });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

async function handleTaskGet(res, storage, taskId) {
  const task = await storage.getTask(taskId);
  if (!task) {
    return sendJson(res, 404, { error: 'task_not_found' });
  }
  return sendJson(res, 200, { task });
}

async function handleTaskUpdate(req, res, storage, taskId) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }

  const task = await storage.updateTask(taskId, body);
  if (!task) {
    return sendJson(res, 404, { error: 'task_not_found' });
  }
  return sendJson(res, 200, { task });
}

async function handleTaskDelete(res, storage, taskId) {
  const success = await storage.deleteTask(taskId);
  if (!success) {
    return sendJson(res, 404, { error: 'task_not_found' });
  }
  return sendNoContent(res);
}

async function handleTasksClearCompleted(res, storage) {
  const count = await storage.clearCompletedTasks();
  return sendJson(res, 200, { deleted: count });
}

async function handleTaskRetry(res, storage, taskId) {
  const task = await storage.getTask(taskId);
  if (!task) {
    return sendJson(res, 404, { error: 'task_not_found' });
  }

  const resetTask = await storage.updateTask(taskId, {
    status: 'pending',
    progress: 0,
    stage: null,
    error: null,
    completedAt: null,
  });

  return sendJson(res, 200, { task: resetTask });
}

function registerTaskRoutes(router, deps) {
  const { storage } = deps;
  router.add('GET', '/api/tasks', (req, res, ctx) => handleTasksList(res, ctx.url, storage));
  router.add('POST', '/api/tasks', (req, res) => handleTaskCreate(req, res, storage));
  router.add('DELETE', '/api/tasks/clear-completed', (req, res) => handleTasksClearCompleted(res, storage));
  router.add('POST', '/api/tasks/:taskId/retry', (req, res, ctx) =>
    handleTaskRetry(res, storage, ctx.params.taskId)
  );
  router.add('GET', '/api/tasks/:taskId', (req, res, ctx) => handleTaskGet(res, storage, ctx.params.taskId));
  router.add('PATCH', '/api/tasks/:taskId', (req, res, ctx) =>
    handleTaskUpdate(req, res, storage, ctx.params.taskId)
  );
  router.add('DELETE', '/api/tasks/:taskId', (req, res, ctx) =>
    handleTaskDelete(res, storage, ctx.params.taskId)
  );
}

module.exports = {
  registerTaskRoutes,
};
