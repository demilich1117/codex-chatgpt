// Batch native row insertions, replacements and removals. Streamed text and media
// do not change a toolbar or a reasoning header.
export function watchMessageRows(chat, { attributes, structure, sync, remove }) {
  const dirty = new Set(chat.querySelectorAll(':scope > .mes'));
  let frame = 0;
  let previousLast = null;

  function flush() {
    frame = 0;
    let last = chat.lastElementChild;
    while (last && !last.matches('.mes')) last = last.previousElementSibling;
    if (previousLast && previousLast !== last) dirty.add(previousLast);
    if (last) dirty.add(last);
    previousLast = last;
    for (const row of dirty) {
      if (row.parentElement !== chat) {
        remove(row);
        dirty.delete(row);
      }
    }
    sync(dirty);
    dirty.clear();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(flush);
  }

  function updateMessage(id) {
    if (Number.isInteger(id) && id >= 0) {
      const row = chat.querySelector(':scope > .mes[mesid="' + id + '"]');
      if (row) dirty.add(row);
    }
    schedule();
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.target === chat) {
        for (const nodes of [record.addedNodes, record.removedNodes]) {
          for (const node of nodes) if (node.matches?.('.mes')) dirty.add(node);
        }
      } else {
        // Host markup can be replaced inside an existing row (swipes and edits).
        if (record.type === 'childList' && !record.target.matches(structure)) continue;
        const row = record.target.closest('.mes');
        if (row?.parentElement === chat) dirty.add(row);
      }
    }
    if (dirty.size) schedule();
  });
  observer.observe(chat, { childList: true, subtree: true, attributes: true, attributeFilter: attributes });
  flush();
  return {
    schedule, updateMessage,
    refresh() {
      for (const row of chat.querySelectorAll(':scope > .mes')) dirty.add(row);
      schedule();
    },
    disconnect() {
      observer.disconnect();
      cancelAnimationFrame(frame);
      dirty.clear();
    },
  };
}
