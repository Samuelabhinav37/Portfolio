/**
 * Bridges plain MDX output onto the v2.5 template's class system so post
 * authors write normal markdown and the design applies automatically:
 *
 *   p          -> .body-text
 *   h2 / h3    -> .heading-2 / .heading-3
 *   ul         -> .lead-list
 *   blockquote -> .pull-quote
 *   pre        -> wrapped in .code-wrap with a Copy button, class .code-block
 *   inline code -> .code-inline
 *
 * Elements that already carry a class (template components) are left alone.
 */
export default function rehypeTemplateClasses() {
  const map = {
    p: 'body-text',
    h2: 'heading-2',
    h3: 'heading-3',
    ul: 'lead-list',
    blockquote: 'pull-quote',
  };

  function addClass(node, cls) {
    node.properties = node.properties || {};
    const existing = node.properties.className;
    if (Array.isArray(existing)) existing.push(cls);
    else if (typeof existing === 'string') node.properties.className = [existing, cls];
    else node.properties.className = [cls];
  }

  function walk(node, parent, index) {
    if (node.type === 'element') {
      const has = node.properties && node.properties.className;

      if (node.tagName === 'pre') {
        addClass(node, 'code-block');
        // Wrap: <div class="code-wrap"><pre/><button class="copy-btn">Copy</button></div>
        if (parent && typeof index === 'number' && !(parent.tagName === 'div' && has)) {
          parent.children[index] = {
            type: 'element',
            tagName: 'div',
            properties: { className: ['code-wrap'] },
            children: [
              node,
              {
                type: 'element',
                tagName: 'button',
                properties: { className: ['copy-btn'], type: 'button' },
                children: [{ type: 'text', value: 'Copy' }],
              },
            ],
          };
        }
      } else if (node.tagName === 'code' && parent && parent.tagName !== 'pre' && !has) {
        addClass(node, 'code-inline');
      } else if (map[node.tagName] && !has) {
        addClass(node, map[node.tagName]);
      }
    }
    if (node.children) {
      // iterate over a copy: pre-wrapping replaces children in place
      [...node.children].forEach((child) => {
        const i = node.children.indexOf(child);
        walk(child, node, i);
      });
    }
  }

  return (tree) => walk(tree, null, null);
}
