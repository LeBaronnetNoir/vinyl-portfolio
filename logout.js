export default async function handler(req, res) {
  res.setHeader('Set-Cookie', [
    'ossature_user=; Path=/; Max-Age=0',
    'ossature_token=; Path=/; Max-Age=0',
    'ossature_secret=; Path=/; Max-Age=0'
  ]);
  res.redirect(302, '/');
}
