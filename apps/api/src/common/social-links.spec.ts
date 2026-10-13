import { normalizeSocialLinks } from './social-links';

describe('normalizeSocialLinks', () => {
  it('limpia y conserva valores válidos', () => {
    expect(normalizeSocialLinks({ instagram: ' @ana ', tiktok: '', linkedin: 'https://linkedin.com/in/ana' }))
      .toEqual({ instagram: '@ana', linkedin: 'https://linkedin.com/in/ana' });
  });
  it('rechaza redes desconocidas y enlaces peligrosos', () => {
    expect(() => normalizeSocialLinks({ myspace: 'x' })).toThrow();
    expect(() => normalizeSocialLinks({ instagram: 'javascript:alert(1)' })).toThrow();
    expect(() => normalizeSocialLinks({ instagram: 42 })).toThrow();
  });
});
