const data = `import { BaseModel, BelongsTo, belongsTo, column } from "@ioc:Adonis/Lucid/Orm";
import { DateTime } from "luxon";
import UserProfile from "./User/UserProfile";

export default class ActivityLog extends BaseModel {
  @column({ isPrimary: true })
  public id: number;

  @column()
  public lodgeable_id: string;

  @column()
  public lodgeable_type: boolean[];

  @column()
  public message: string;

  @column()
  public recorder_id: string;

  @column()
  public recorder_type: string;

  @column()
  public event_type: string | null;

  @column()
  public event_data: any;

  @column.dateTime()
  public created_at: DateTime;

  @column.dateTime()
  public updated_at: DateTime;

  @belongsTo(() => UserProfile, { foreignKey: "recorder_id", localKey: "uid" })
  public recorder: BelongsTo<typeof UserProfile>;

  public static async record_an_event(message: string, obj: any, user, optional_args = { event_type: null, event_data: null }) {
    const activity_log = new ActivityLog();
    activity_log.lodgeable_id = obj.id;
    activity_log.lodgeable_type = obj.class.name;

    activity_log.recorder_id = user.id;
    activity_log.recorder_type = user.class.name;

    activity_log.message = message;

    activity_log.event_type = optional_args.event_type;
    activity_log.event_data = optional_args.event_data;

    await activity_log.save();
  }
}
`;

module.exports = data;
