export const handler = async (event) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Placeholder — web app not deployed yet',
      timestamp: new Date().toISOString(),
    }),
  };
};
