import { ObjectId } from "mongodb";
import { IOrganisationRoleDatabaseService } from "../organisation-role-database/organisation-role-database";
import { IMailerService } from "../send-emails/mailer";
import { ISubscriptionDatabaseService } from "../subscription-database/subscription-database";
import { IUseageSummaryService } from "../useage-summary/useage-summary";
import { IUserDatabaseService } from "../users-database/users-database";

export interface IParentProgressEmailManager {
    startAllWeeklyParentalEmails(): Promise<boolean>;

    sendParentalEmailForUserId(userId: string): Promise<boolean>;
}

export class ParentProgressEmailManager implements IParentProgressEmailManager {

    constructor(private readonly userDatabaseService: IUserDatabaseService,
                private readonly mailerService: IMailerService,
                private readonly useageSummaryService: IUseageSummaryService,
                private readonly subscriptionDataBaseService: ISubscriptionDatabaseService,
                private readonly organisationalRoleDatabase: IOrganisationRoleDatabaseService) {

    }

    public async startAllWeeklyParentalEmails(): Promise<boolean> {
        const [activePremiumSubscriptions, activeTrialSubscriptions] = await Promise.all([
            this.subscriptionDataBaseService.getActiveIndividualPremiumSubscriptions(),
            this.subscriptionDataBaseService.getActiveIndividualTrialSubscriptions()
        ]);

        const activeTrialUserIds = activeTrialSubscriptions.map((s) => s.userId.toHexString());
        const organisationUsersOnTrial =
            await this.organisationalRoleDatabase.getOrganisationRolesUsingUserIds(
            activeTrialUserIds
        );

        // Only ones who aren't in organisations...
        const relevantTrialUsers = activeTrialUserIds.filter(
            (u) => {
                if (organisationUsersOnTrial[u] !== undefined) {
                    return organisationUsersOnTrial[u].length === 0;
                }
            }
        );

        const allRelevantUserIds = [
            ...activePremiumSubscriptions.map((s) => s.userId.toHexString()),
            ...relevantTrialUsers
        ];

        const users = await this.userDatabaseService.getUsersByUserIds(
            allRelevantUserIds
        );

        const usersWithParentalEmails = users.filter(
            (u) => (u.emailsToSendRegularReports && u.emailsToSendRegularReports.length > 0)
        );

        usersWithParentalEmails.forEach(
            (u, i) => {
                setTimeout(() => {
                    this.sendParentalEmailForUserId(u.id.toHexString());
                }, 1000 * i);
            }
        );

        return true;
    }

    public async sendParentalEmailForUserId(userId: string): Promise<boolean> {

        const today = (new Date());
        const thisMorning = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );

        const lastWeek = new Date(thisMorning);
        // const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);

        const [usageSummary, user] = await Promise.all([
            this.useageSummaryService.getUseageSummaryForIndividual(
              new ObjectId(userId),
              lastWeek.toISOString(),
              thisMorning.toISOString()
            ),
            this.userDatabaseService.getUserByUserId(  userId  )
          ]);

        const yesterday = new Date(thisMorning);
        yesterday.setDate(yesterday.getDate() - 1);
        let r = true;
        const nameCapitalized = user.firstname.charAt(0).toUpperCase() +
            user.firstname.slice(1).toLocaleLowerCase();
        if (user.emailsToSendRegularReports) {
            const successes = await Promise.all(
                user.emailsToSendRegularReports.map(
                    (email) => {
                        return this.mailerService.sendRegularProgressEmailToNamedIndividual(
                            email,
                            nameCapitalized,
                            lastWeek.toDateString(),
                            yesterday.toDateString(),
                            usageSummary
                          );
                    }
                )
            );

            r = successes.every((s) => s);
        }

        return r;
    }

}
