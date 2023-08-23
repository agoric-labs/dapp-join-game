import { useEffect } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import agoricLogo from '/agoric.svg';
import './App.css';
import {
  makeAgoricChainStorageWatcher,
  AgoricChainStoragePathKind as Kind,
} from '@agoric/rpc';
import { create } from 'zustand';
import {
  makeAgoricWalletConnection,
  suggestChain,
} from '@agoric/web-components';
import { subscribeLatest } from '@agoric/notifier';
import { stringifyAmountValue } from '@agoric/ui-components';

type Wallet = Awaited<ReturnType<typeof makeAgoricWalletConnection>>;

const watcher = makeAgoricChainStorageWatcher(
  'http://localhost:26657',
  'agoriclocal'
);

interface Purse {
  brand: unknown;
  brandPetname: string;
  currentAmount: { brand: unknown; value: bigint | Array<[string, bigint]> };
  displayInfo: {
    decimalPlaces: number;
    assetKind: unknown;
  };
}

interface AppState {
  wallet?: Wallet;
  gameInstance?: unknown;
  brands?: Array<[string, unknown]>;
  purses?: Array<Purse>;
}

const useAppStore = create<AppState>(() => ({}));

const setup = async () => {
  watcher.watchLatest<Array<[string, unknown]>>(
    [Kind.Data, 'published.agoricNames.instance'],
    instances => {
      console.log('got instances', instances);
      useAppStore.setState({
        gameInstance: instances.find(([name]) => name === 'game1')!.at(1),
      });
    }
  );

  watcher.watchLatest<Array<[string, unknown]>>(
    [Kind.Data, 'published.agoricNames.brand'],
    brands => {
      console.log('Got brands', brands);
      useAppStore.setState({
        brands,
      });
    }
  );
};

const connectWallet = async () => {
  await suggestChain('https://local.agoric.net/network-config');
  const wallet = await makeAgoricWalletConnection(watcher);
  useAppStore.setState({ wallet });
  const { pursesNotifier } = wallet;
  for await (const purses of subscribeLatest(pursesNotifier)) {
    console.log('got purses', purses);
    useAppStore.setState({ purses });
  }
};

const makeOffer = () => {
  const { wallet, gameInstance, brands } = useAppStore.getState();
  const placeBrand = brands?.find(([name]) => name === 'Place')?.at(1);
  const istBrand = brands?.find(([name]) => name === 'IST')?.at(1);

  const want = {
    Places: {
      brand: placeBrand,
      value: {
        '#tag': 'copyBag',
        payload: [
          ['Park Place', 1n],
          ['Boardwalk', 1n],
          ['Water Works', 1n],
        ],
      },
    },
  };

  const give = { Price: { brand: istBrand, value: 250000n } };

  wallet?.makeOffer(
    {
      source: 'contract',
      instance: gameInstance,
      publicInvitationMaker: 'makeJoinInvitation',
    },
    { give, want },
    undefined,
    (update: { status: string; data?: unknown }) => {
      if (update.status === 'error') {
        alert(`Offer error: ${update.data}`);
      }
      if (update.status === 'accepted') {
        alert('Offer accepted');
      }
      if (update.status === 'refunded') {
        alert('Offer rejected');
      }
    }
  );
};

function App() {
  useEffect(() => {
    setup();
  }, []);

  const { wallet, purses } = useAppStore(({ wallet, purses }) => ({
    wallet,
    purses,
  }));
  const istPurse = purses?.find(p => p.brandPetname === 'IST');
  const placesPurse = purses?.find(p => p.brandPetname === 'Place');

  const buttonLabel = wallet ? 'Make Offer' : 'Connect Wallet';
  const onClick = () => {
    if (wallet) {
      makeOffer();
    } else {
      connectWallet();
    }
  };

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
        <a href="https://agoric.com/develop" target="_blank">
          <img src={agoricLogo} className="logo agoric" alt="Agoric logo" />
        </a>
      </div>
      <h1>Vite + React + Agoric</h1>
      <div className="card">
        <div>
          {wallet && <div>{wallet.address}</div>}
          {istPurse && (
            <div>
              <b>IST: </b>
              {stringifyAmountValue(
                istPurse.currentAmount,
                istPurse.displayInfo.assetKind,
                istPurse.displayInfo.decimalPlaces
              )}
            </div>
          )}
          {wallet && (
            <div>
              <b>Places: </b>
              {placesPurse ? (
                <ul>
                  {(
                    placesPurse.currentAmount.value as Array<[string, bigint]>
                  ).map(([name, number]) => (
                    <li>
                      {String(number)} {name}
                    </li>
                  ))}
                </ul>
              ) : (
                'None'
              )}
            </div>
          )}
        </div>
        <button onClick={onClick}>{buttonLabel}</button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">Click on the logos to learn more</p>
    </>
  );
}

export default App;
