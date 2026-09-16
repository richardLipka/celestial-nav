// The one thing the prose in this application is allowed to carry beyond
// plain text: **a term being defined** and *a word being leaned on*.
//
// Everything is escaped first, so the only tags that can ever reach innerHTML
// are the two put there here. Inline maths is left exactly as written, because
// MathJax comes along afterwards and looks for its own \( ... \) delimiters.
//
// Both of the places that show authored prose use this. The theory tab did the
// escaping without the emphasis and the lesson bar did neither, so for as long
// as the tab has existed `**intercept**` reached the page with its asterisks
// showing -- in both languages, where nobody reading would have guessed it was
// meant to be bold.

export function richText(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
