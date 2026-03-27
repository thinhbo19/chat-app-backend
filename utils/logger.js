/**
 * Log có cấu trúc (JSON một dòng) — dễ grep / ship sang hệ thống log.
 * Không phụ thuộc thư viện ngoài.
 */
function write(level, event, fields = {}) {
  const line = JSON.stringify({
    level,
    event,
    time: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

const logger = {
  info(event, fields) {
    write("info", event, fields);
  },
  warn(event, fields) {
    write("warn", event, fields);
  },
  error(event, fields) {
    write("error", event, fields);
  },
};

module.exports = { logger };
