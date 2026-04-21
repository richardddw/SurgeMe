import { describe, it } from 'mocha';
import { expect } from 'earl';
import { HostnameSmolTrie, HostnameTrie } from './trie';

function createTrie<Meta = any>(from: string[] | Set<string> | null, smolTree: true): HostnameSmolTrie<Meta>;
function createTrie<Meta = any>(from?: string[] | Set<string> | null, smolTree?: false): HostnameTrie<Meta>;
function createTrie<_Meta = any>(from?: string[] | Set<string> | null, smolTree = true) {
  if (smolTree) {
    return new HostnameSmolTrie(from);
  }
  return new HostnameTrie(from);
};

// describe('hostname to tokens', () => {
//   it('should split hostname into tokens.', () => {
//     expect(hostnameToTokens('.blog.skk.moe')).toEqual([
//       '.',
//       'blog',
//       '.',
//       'skk',
//       '.',
//       'moe'
//     ]);

//     expect(hostnameToTokens('blog.skk.moe')).toEqual([
//       'blog',
//       '.',
//       'skk',
//       '.',
//       'moe'
//     ]);

//     expect(hostnameToTokens('skk.moe')).toEqual([
//       'skk',
//       '.',
//       'moe'
//     ]);

//     expect(hostnameToTokens('moe')).toEqual([
//       'moe'
//     ]);
//   });
// });

describe('Trie', () => {
  it('should be possible to add domains to a Trie.', () => {
    const trie = createTrie(null, false);

    trie.add('a.skk.moe');
    trie.add('skk.moe');
    trie.add('anotherskk.moe');

    expect(trie.size).toEqual(3);

    expect(trie.has('a.skk.moe')).toEqual(true);
    expect(trie.has('skk.moe')).toEqual(true);
    expect(trie.has('anotherskk.moe')).toEqual(true);
    expect(trie.has('example.com')).toEqual(false);
    expect(trie.has('skk.mo')).toEqual(false);
    expect(trie.has('another.skk.moe')).toEqual(false);
  });

  it('adding the same item several times should not increase size.', () => {
    const trie = createTrie(null, false);

    trie.add('skk.moe');
    trie.add('blog.skk.moe');
    // eslint-disable-next-line sukka/no-element-overwrite -- deliberately do testing
    trie.add('skk.moe');

    expect(trie.size).toEqual(2);
    expect(trie.has('skk.moe')).toEqual(true);
  });

  it('should be possible to set the null sequence.', () => {
    const trie = createTrie(null, false);

    trie.add('');
    expect(trie.has('')).toEqual(true);

    const trie2 = createTrie(null, true);
    trie2.add('');
    expect(trie2.has('')).toEqual(true);
  });

  it('should be possible to delete items.', () => {
    const trie = createTrie(null, false);

    trie.add('skk.moe');
    trie.add('blog.skk.moe');
    trie.add('example.com');
    trie.add('moe.sb');

    expect(trie.delete('no-match.com')).toEqual(false);
    expect(trie.delete('example.org')).toEqual(false);

    expect(trie.delete('skk.moe')).toEqual(true);
    expect(trie.has('skk.moe')).toEqual(false);
    expect(trie.has('moe.sb')).toEqual(true);

    expect(trie.size).toEqual(3);

    expect(trie.delete('example.com')).toEqual(true);
    expect(trie.size).toEqual(2);
    expect(trie.delete('moe.sb')).toEqual(true);
    expect(trie.size).toEqual(1);
  });

  it('should be possible to check the existence of a sequence in the Trie.', () => {
    const trie = createTrie(null, true);

    trie.add('example.org.skk.moe');

    expect(trie.has('example.org.skk.moe')).toEqual(true);
    expect(trie.has('skk.moe')).toEqual(false);
    expect(trie.has('example.org')).toEqual(false);
    expect(trie.has('')).toEqual(false);
  });

  it('should be possible to retrieve items matching the given prefix.', () => {
    const trie = createTrie(null, false);

    trie.add('example.com');
    trie.add('blog.example.com');
    trie.add('cdn.example.com');
    trie.add('example.org');

    expect(trie.find('example.com')).toEqual(['example.com', 'cdn.example.com', 'blog.example.com']);
    expect(trie.find('com')).toEqual(['example.com', 'cdn.example.com', 'blog.example.com']);
    expect(trie.find('.example.com')).toEqual(['cdn.example.com', 'blog.example.com']);
    expect(trie.find('org')).toEqual(['example.org']);
    expect(trie.find('example.net')).toEqual([]);
    expect(trie.dump()).toEqual(['example.org', 'example.com', 'cdn.example.com', 'blog.example.com']);
  });

  it('should be possible to retrieve items matching the given prefix even with a smol trie', () => {
    const trie = createTrie(null, true);

    trie.add('.example.com');
    trie.add('example.com');
    trie.add('blog.example.com');
    trie.add('cdn.example.com');
    trie.add('example.org');

    expect(trie.find('example.com')).toEqual(['.example.com']);
    expect(trie.find('com')).toEqual(['.example.com']);
    expect(trie.find('.example.com')).toEqual(['.example.com']);
    expect(trie.find('org')).toEqual(['example.org']);
    expect(trie.find('example.net')).toEqual([]);
    expect(trie.dump()).toEqual(['example.org', '.example.com']);
  });

  it('should be possible to create a trie from an arbitrary iterable.', () => {
    let trie = createTrie(['skk.moe', 'blog.skk.moe'], false);

    expect(trie.size).toEqual(2);
    expect(trie.has('skk.moe')).toEqual(true);

    trie = createTrie(new Set(['skk.moe', 'example.com']), false);
    expect(trie.size).toEqual(2);
    expect(trie.has('skk.moe')).toEqual(true);
  });
});

describe('surge domainset dedupe', () => {
  it('should not remove same entry', () => {
    const trie = createTrie(['.skk.moe', 'noc.one'], false);

    expect(trie.find('.skk.moe')).toEqual(['.skk.moe']);
    expect(trie.find('noc.one')).toEqual(['noc.one']);
  });

  it('should match subdomain - 1', () => {
    const trie = createTrie(['www.noc.one', 'www.sukkaw.com', 'blog.skk.moe', 'image.cdn.skk.moe', 'cdn.sukkaw.net'], false);

    expect(trie.find('.skk.moe')).toEqual(['image.cdn.skk.moe', 'blog.skk.moe']);
    expect(trie.find('.sukkaw.com')).toEqual(['www.sukkaw.com']);
  });

  it('should match subdomain - 2', () => {
    const trie = createTrie(['www.noc.one', 'www.sukkaw.com', '.skk.moe', 'blog.skk.moe', 'image.cdn.skk.moe', 'cdn.sukkaw.net'], false);

    expect(trie.find('.skk.moe')).toEqual(['.skk.moe', 'image.cdn.skk.moe', 'blog.skk.moe']);
    expect(trie.find('.sukkaw.com')).toEqual(['www.sukkaw.com']);
  });

  it('should not remove non-subdomain', () => {
    const trie = createTrie(['skk.moe', 'sukkaskk.moe'], false);
    expect(trie.find('.skk.moe')).toEqual([]);
  });
});

describe('smol tree', () => {
  it('should init tree', () => {
    const trie = createTrie([
      'skk.moe',
      'anotherskk.moe',
      'blog.anotherskk.moe',
      'blog.skk.moe',
      '.cdn.local',
      'blog.img.skk.local',
      'img.skk.local'
    ], true);

    expect(trie.dump()).toEqual([
      'img.skk.local',
      'blog.img.skk.local',
      '.cdn.local',
      'anotherskk.moe',
      'blog.anotherskk.moe',
      'skk.moe',
      'blog.skk.moe'
    ]);
  });

  it('should create simple tree - 1', () => {
    const trie = createTrie([
      '.skk.moe', 'blog.skk.moe', '.cdn.skk.moe', 'skk.moe',
      'www.noc.one', 'cdn.noc.one',
      '.blog.sub.example.com', 'sub.example.com', 'cdn.sub.example.com', '.sub.example.com'
    ], true);

    expect(trie.dump()).toEqual([
      '.sub.example.com',
      'cdn.noc.one',
      'www.noc.one',
      '.skk.moe'
    ]);
  });

  it('should create simple tree - 2', () => {
    const trie = createTrie([
      '.skk.moe', 'blog.skk.moe', '.cdn.skk.moe', 'skk.moe'
    ], true);

    expect(trie.dump()).toEqual([
      '.skk.moe'
    ]);
  });

  it('should create simple tree - 3', () => {
    const trie = createTrie([
      '.blog.sub.example.com', 'cdn.sub.example.com', '.sub.example.com'
    ], true);

    expect(trie.dump()).toEqual([
      '.sub.example.com'
    ]);

    trie.add('.sub.example.com');
    expect(trie.dump()).toEqual([
      '.sub.example.com'
    ]);
  });

  it('should create simple tree - 3', () => {
    const trie = createTrie([
      'commercial.shouji.360.cn',
      'act.commercial.shouji.360.cn',
      'cdn.creative.medialytics.com',
      'px.cdn.creative.medialytics.com'
    ], true);

    expect(trie.dump()).toEqual([
      'cdn.creative.medialytics.com',
      'px.cdn.creative.medialytics.com',
      'commercial.shouji.360.cn',
      'act.commercial.shouji.360.cn'
    ]);
  });

  it('should dedupe subdomain properly', () => {
    const trie = createTrie([
      'skk.moe',
      'anotherskk.moe',
      'blog.anotherskk.moe',
      'blog.skk.moe'
    ], true);

    expect(trie.dump()).toEqual([
      'anotherskk.moe',
      'blog.anotherskk.moe',
      'skk.moe',
      'blog.skk.moe'
    ]);
  });

  it('should effctly whitelist domains', () => {
    const trie = createTrie([
      'skk.moe',
      'anotherskk.moe',
      'blog.anotherskk.moe',
      'blog.skk.moe',
      '.cdn.local',
      'blog.img.skk.local',
      'img.skk.local'
    ], true);

    trie.whitelist('.skk.moe');

    expect(trie.dump()).toEqual([
      'img.skk.local',
      'blog.img.skk.local',
      '.cdn.local',
      'anotherskk.moe',
      'blog.anotherskk.moe'
    ]);

    trie.whitelist('anotherskk.moe');
    expect(trie.dump()).toEqual([
      'img.skk.local',
      'blog.img.skk.local',
      '.cdn.local',
      'blog.anotherskk.moe'
    ]);

    trie.add('anotherskk.moe');
    trie.whitelist('.anotherskk.moe');

    expect(trie.dump()).toEqual([
      'img.skk.local',
      'blog.img.skk.local',
      '.cdn.local'
    ]);

    trie.whitelist('img.skk.local');
    expect(trie.dump()).toEqual([
      'blog.img.skk.local',
      '.cdn.local'
    ]);

    trie.whitelist('cdn.local');
    expect(trie.dump()).toEqual([
      'blog.img.skk.local'
    ]);

    trie.whitelist('.skk.local');
    expect(trie.dump()).toEqual([]);
  });

  it('should whitelist trie correctly', () => {
    const trie = createTrie([
      '.t.co',
      't.co',
      'example.t.co',
      '.skk.moe',
      'blog.cdn.example.com',
      'cdn.example.com'
    ], true);

    expect(trie.dump()).toEqual([
      'cdn.example.com', 'blog.cdn.example.com',
      '.skk.moe',
      '.t.co'
    ]);

    trie.whitelist('.t.co');
    expect(trie.dump()).toEqual([
      'cdn.example.com', 'blog.cdn.example.com', '.skk.moe'
    ]);

    trie.whitelist('skk.moe');
    expect(trie.dump()).toEqual(['cdn.example.com', 'blog.cdn.example.com']);

    trie.whitelist('cdn.example.com');
    expect(trie.dump()).toEqual(['blog.cdn.example.com']);
  });

  it('contains - normal', () => {
    const trie = createTrie([
      'skk.moe',
      'anotherskk.moe',
      'blog.anotherskk.moe',
      'blog.skk.moe'
    ], true);

    expect(trie.contains('skk.moe')).toEqual(true);
    expect(trie.contains('blog.skk.moe')).toEqual(true);
    expect(trie.contains('anotherskk.moe')).toEqual(true);
    expect(trie.contains('blog.anotherskk.moe')).toEqual(true);

    expect(trie.contains('example.com')).toEqual(false);
    expect(trie.contains('blog.example.com')).toEqual(false);
    expect(trie.contains('skk.mo')).toEqual(false);
    expect(trie.contains('cdn.skk.moe')).toEqual(false);
  });

  it('contains - subdomain', () => {
    const trie = createTrie([
      'index.rubygems.org'
    ], true);

    expect(trie.contains('rubygems.org')).toEqual(false);
    expect(trie.contains('index.rubygems.org')).toEqual(true);
    expect(trie.contains('sub.index.rubygems.org')).toEqual(false);
  });

  it('contains - include subdomains', () => {
    const trie = createTrie([
      '.skk.moe'
    ], true);

    expect(trie.contains('skk.moe')).toEqual(true);
    expect(trie.contains('blog.skk.moe')).toEqual(true);
    expect(trie.contains('image.cdn.skk.moe')).toEqual(true);

    expect(trie.contains('example.com')).toEqual(false);
    expect(trie.contains('blog.example.com')).toEqual(false);
    expect(trie.contains('skk.mo')).toEqual(false);
  });
});
