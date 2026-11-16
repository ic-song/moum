export function performUpload(transport, request, timeout = 120000) {
  if (!Number.isFinite(timeout) || timeout <= 0) return Promise.reject(new RangeError('전송 제한 시간은 양수입니다.'));
  return new Promise((resolve, reject) => {
    let done = false, timer;
    const finish = (error, value) => { if (done) return; done = true; clearTimeout(timer); request.signal.removeEventListener('abort', abort); if (error) reject(error); else resolve(value); };
    const abort = () => finish(new DOMException('업로드 취소', 'AbortError'));
    if (request.signal.aborted) { abort(); return; }
    request.signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => { const error = new Error('전송 응답 시간이 초과되었습니다. 서버 수신 여부를 확인하세요.'); error.name = 'TimeoutError'; finish(error); }, timeout);
    Promise.resolve().then(() => { if (request.signal.aborted) throw new DOMException('업로드 취소', 'AbortError'); return transport(request); }).then(value => finish(null, value), error => finish(error));
  });
}

export function createXHRTransport(url, options = {}) {
  return ({ file, data, signal, onProgress, metadata }) => new Promise((resolve, reject) => {
    const target = new URL(url, globalThis.location?.href); if (!['http:', 'https:'].includes(target.protocol)) { reject(new Error('HTTP(S) 업로드 주소가 필요합니다.')); return; }
    if (signal.aborted) { reject(new DOMException('업로드 취소', 'AbortError')); return; }
    const xhr = new XMLHttpRequest(), body = new FormData(); body.append(options.fieldName || 'file', file, file.name); body.append('metadata', JSON.stringify(metadata)); if (data) body.append('data', JSON.stringify(data));
    const abort = () => xhr.abort(); signal.addEventListener('abort', abort, { once: true });
    const cleanup = () => signal.removeEventListener('abort', abort);
    xhr.open(options.method || 'POST', target.href); xhr.timeout = options.timeout ?? 120000; xhr.withCredentials = options.withCredentials ?? false;
    for (const [name, value] of Object.entries(options.headers || {})) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total * 100); };
    xhr.onload = () => { cleanup(); if (xhr.status >= 200 && xhr.status < 300) { let result = xhr.responseText; try { result = JSON.parse(result); } catch { /* Text responses are valid transport results. */ } resolve(result); } else reject(new Error(`업로드 HTTP ${xhr.status}`)); };
    xhr.onerror = () => { cleanup(); reject(new Error('네트워크 오류입니다. 연결을 확인하고 재시도하세요.')); };
    xhr.ontimeout = () => { cleanup(); reject(new Error('업로드 시간이 초과되었습니다. 서버의 수신 여부를 확인한 뒤 재시도하세요.')); };
    xhr.onabort = () => { cleanup(); reject(new DOMException('업로드 취소', 'AbortError')); }; xhr.send(body);
  });
}
