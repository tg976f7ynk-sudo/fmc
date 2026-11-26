/**
 * Markdown-Erweiterungen für die Vereinsseite:
 *  1. Bilder ohne Pfad ("foto.jpg") liegen neben dem Beitrag -> "./foto.jpg"
 *  2. Eine Zeile, die nur einen YouTube-Link enthält, wird zum Video (lädt erst nach Klick)
 *  3. Mehrere Bilder direkt hintereinander werden zu einer Bilderreihe
 */
const istRelativ = (url) => !/^(\.{1,2}\/|\/|[a-z][a-z0-9+.-]*:|#)/i.test(url);

function youtubeId(url) {
  const m =
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i.exec(url || '');
  return m ? m[1] : null;
}

function nurBilder(node) {
  if (node.type !== 'paragraph') return false;
  const inhalt = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()) && c.type !== 'break');
  return inhalt.length > 0 && inhalt.every((c) => c.type === 'image');
}

function besuche(node, fn) {
  fn(node);
  if (node.children) node.children.forEach((c) => besuche(c, fn));
}

export function remarkFmc() {
  return (tree) => {
    // 1. relative Bildpfade
    besuche(tree, (node) => {
      if (node.type === 'image' && node.url && istRelativ(node.url)) node.url = './' + node.url;
    });

    // 2. YouTube-Links
    tree.children = tree.children.map((node) => {
      if (node.type !== 'paragraph' || node.children.length !== 1) return node;
      const kind = node.children[0];
      const url = kind.type === 'link' ? kind.url : kind.type === 'text' ? kind.value.trim() : '';
      const id = youtubeId(url);
      if (!id || /\s/.test(url)) return node;
      return {
        type: 'html',
        value:
          `<div class="video" data-youtube="${id}"><button type="button" class="video-start">` +
          `<span class="video-play" aria-hidden="true"></span><span>Video abspielen</span>` +
          `<small>Das Video wird von YouTube geladen. Dabei werden Daten an YouTube übertragen.</small></button></div>`,
      };
    });

    // 3. Bilderreihen
    const neu = [];
    for (const node of tree.children) {
      const letzter = neu[neu.length - 1];
      if (nurBilder(node)) {
        const bilder = node.children.filter((c) => c.type === 'image');
        if (letzter && letzter.type === 'bilderreihe') letzter.children.push(...bilder);
        else neu.push({ type: 'bilderreihe', children: bilder, data: { hName: 'div', hProperties: {} } });
      } else neu.push(node);
    }
    for (const node of neu) {
      if (node.type === 'bilderreihe') {
        const n = node.children.length;
        node.data.hProperties.className = n === 1 ? ['bild'] : ['bilderreihe', `anzahl-${Math.min(n, 4)}`];
      }
    }
    tree.children = neu;
  };
}
