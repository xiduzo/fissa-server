import {
  Collection,
  CollectionOptions,
  Db,
  Document,
  MongoClient,
  ServerApiVersion,
} from "mongodb";
import { MONGO_CREDENTIALS } from "../lib/constants/credentials";
import { Room } from "../lib/interfaces/Room";
import { SortedVote, Vote, VoteState } from "../lib/interfaces/Vote";
import { publishAsync } from "./mqtt";
import { getMeAsync, reorderPlaylist } from "./spotify";

const { user, password } = MONGO_CREDENTIALS;

export const mongoClient = new MongoClient(
  `mongodb+srv://${user}:${password}@fissa.yp209.mongodb.net/?retryWrites=true&w=majority`,
  {
    serverApi: ServerApiVersion.v1,
  }
);

export const mongoDbAsync = async (): Promise<Db> => {
  return new Promise(async (resolve, reject) => {
    try {
      mongoClient.connect(async (error, client) => {
        if (error) {
          throw new Error(error.message);
        }

        resolve(client.db("fissa"));
      });
    } catch (error) {
      await mongoClient.close();
      reject(error);
    }
  });
};

export const mongoCollectionAsync = async (
  name: string,
  options?: CollectionOptions
): Promise<Collection<Document>> => {
  return new Promise(async (resolve, reject) => {
    try {
      const database = await mongoDbAsync();
      resolve(database.collection(name, options));
    } catch (error) {
      reject(error);
    }
  });
};

const sortVotes = (votes: Vote[]): SortedVote[] => {
  const reduced = votes.reduce((curr, vote) => {
    const index = curr.findIndex(
      (sortedVote) => sortedVote.trackUri === vote.trackUri
    );

    const addToTotal = vote.state === VoteState.Upvote ? 1 : -1;
    if (index === -1) {
      curr.push({
        trackUri: vote.trackUri,
        total: addToTotal,
        votes: [vote],
      });
    } else {
      curr[index].total = curr[index].total + addToTotal;
      curr[index].votes.push(vote);
    }

    return curr;
  }, [] as SortedVote[]);

  return reduced.sort((a, b) => b.total - a.total);
};

const saveVote = async (
  collection: Collection<Document>,
  state: VoteState,
  vote?: Vote
) => {
  if (!vote) {
    console.log("insert vote", vote);
    await collection.insertOne(vote as Omit<Vote, "_id">);
    return;
  }

  await collection.updateOne(
    { _id: vote.id },
    {
      $set: {
        state,
      },
    }
  );
};

export const voteAsync = async (
  room: Room,
  accessToken: string,
  trackUri: string,
  state: VoteState
): Promise<Partial<Vote>> => {
  return new Promise(async (resolve, reject) => {
    const { pin, playlistId } = room;
    try {
      const me = await getMeAsync(accessToken);

      const collection = await mongoCollectionAsync("votes");
      const _vote: Partial<Vote> = {
        pin,
        createdBy: me.id,
        trackUri,
      };
      console.log("getting vote", _vote);
      const vote = await collection.findOne<Vote>(_vote);

      await saveVote(collection, state, vote);

      const allVotes = await collection.find<Vote>({ pin }).toArray();
      const sorted = sortVotes(allVotes);
      const reorder = reorderPlaylist(accessToken, playlistId, sorted);

      // TODO reorder playlist based on votes
      await reorder;
      await publishAsync(`fissa/room/${pin}/votes`, sorted);
      resolve(_vote);
    } catch (error) {
      reject(error);
    }
  });
};
